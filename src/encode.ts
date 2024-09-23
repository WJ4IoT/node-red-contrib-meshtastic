import type { Node, NodeDef, NodeInitializer } from "node-red";
import { Protobuf } from "@meshtastic/js";

const encoders = {
  [Protobuf.Portnums.PortNum.UNKNOWN_APP]: null,
  [Protobuf.Portnums.PortNum.TEXT_MESSAGE_APP]: new TextEncoder("ascii"),
  [Protobuf.Portnums.PortNum.REMOTE_HARDWARE_APP]:
    new Protobuf.RemoteHardware.HardwareMessage(),
  [Protobuf.Portnums.PortNum.POSITION_APP]: new Protobuf.Mesh.Position(),
  [Protobuf.Portnums.PortNum.NODEINFO_APP]: new Protobuf.Mesh.User(),
  [Protobuf.Portnums.PortNum.ROUTING_APP]: new Protobuf.Mesh.Routing(),
  [Protobuf.Portnums.PortNum.ADMIN_APP]: new Protobuf.Admin.AdminMessage(),
  [Protobuf.Portnums.PortNum.TEXT_MESSAGE_COMPRESSED_APP]: null,
  [Protobuf.Portnums.PortNum.WAYPOINT_APP]: new Protobuf.Mesh.Waypoint(),
  [Protobuf.Portnums.PortNum.AUDIO_APP]: null,
  [Protobuf.Portnums.PortNum.DETECTION_SENSOR_APP]: new TextEncoder(),
  [Protobuf.Portnums.PortNum.REPLY_APP]: new TextEncoder("ascii"),
  [Protobuf.Portnums.PortNum.IP_TUNNEL_APP]: null,
  [Protobuf.Portnums.PortNum.SERIAL_APP]: null,
  [Protobuf.Portnums.PortNum.STORE_FORWARD_APP]:
    new Protobuf.StoreForward.StoreAndForward(),
  [Protobuf.Portnums.PortNum.RANGE_TEST_APP]: new TextEncoder("ascii"),
  [Protobuf.Portnums.PortNum.TELEMETRY_APP]: new Protobuf.Telemetry.Telemetry(),
  [Protobuf.Portnums.PortNum.ZPS_APP]: null,
  [Protobuf.Portnums.PortNum.SIMULATOR_APP]: null,
  [Protobuf.Portnums.PortNum.TRACEROUTE_APP]: null,
  [Protobuf.Portnums.PortNum.NEIGHBORINFO_APP]:
    new Protobuf.Mesh.NeighborInfo(),
  [Protobuf.Portnums.PortNum.PRIVATE_APP]: null,
  [Protobuf.Portnums.PortNum.ATAK_FORWARDER]: null,
};

const nodeInit: NodeInitializer = (red): void => {
  function EncodeNodeConstructor(this: Node, config: NodeDef): void {
    red.nodes.createNode(this, config);

    this.on("input", (msg, send, done) => {
      if (msg.payload) {
        const jsonWriteOptions = {
          emitDefaultValues: true,
          enumAsInteger: true,
        };
        
        let payloadObject = null;
        
        const from = msg.payload.packet.from;
        msg.payload.packet.from = 0;
        
        const to = msg.payload.packet.to;
        msg.payload.packet.to = 0;
        
        const pid = msg.payload.packet.id;
        msg.payload.packet.id = 0;
        
        if (msg.payload.packet.decoded.payload) {
            payloadObject = msg.payload.packet.decoded.payload;
            delete msg.payload.packet.decoded.payload;
        }

        try {
          const envelope = Protobuf.Mqtt.ServiceEnvelope.fromJson(msg.payload, jsonWriteOptions);

          envelope.packet.from = from;
          envelope.packet.to = to;
          envelope.packet.id = pid;

          const portNum = envelope.packet.payloadVariant.value.portnum;

          if (encoders[portNum] === null) {
            console.debug(`No encoder set for portnum ${portNum}`);
          } else {
            const encoder = encoders[portNum];

            if (encoder instanceof TextEncoder) {
              console.debug("TextEncoder detected. Encoding payload", payloadObject);
              envelope.packet.payloadVariant.value.payload = Buffer.from(payloadObject);
            } else {
              console.debug(
                "Encoder was not null and not a TextEncoder. Assuming Protobuf encoder and encoding payloadObject",
              );
              envelope.packet.payloadVariant.value.payload = encoder
                .fromJson(payloadObject)
                .toBinary();
            }

            console.debug(
              `Encoded payload to binary:\n${JSON.stringify(envelope, null, 2)}`,
            );
          }

          const binaryEnvelope = Buffer.from(envelope.toBinary());
          send({
            payload: binaryEnvelope,
          });
        } catch (error) {
          console.error(`could not encode payload: ${error}`);
          throw error;
        }
      }

      done();
    });
  }

  red.nodes.registerType("encode", EncodeNodeConstructor);
};

export default nodeInit;

