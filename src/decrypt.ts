import { Node, NodeDef, NodeInitializer } from "node-red";
const crypto = require('crypto');
import { Protobuf } from "@meshtastic/js";

const decoders = {
  [Protobuf.Portnums.PortNum.UNKNOWN_APP]: null,
  [Protobuf.Portnums.PortNum.TEXT_MESSAGE_APP]: new TextDecoder(),
  [Protobuf.Portnums.PortNum.REMOTE_HARDWARE_APP]:
    new Protobuf.RemoteHardware.HardwareMessage(),
  [Protobuf.Portnums.PortNum.POSITION_APP]: new Protobuf.Mesh.Position(),
  [Protobuf.Portnums.PortNum.NODEINFO_APP]: new Protobuf.Mesh.User(),
  [Protobuf.Portnums.PortNum.ROUTING_APP]: new Protobuf.Mesh.Routing(),
  [Protobuf.Portnums.PortNum.ADMIN_APP]: new Protobuf.Admin.AdminMessage(),
  [Protobuf.Portnums.PortNum.TEXT_MESSAGE_COMPRESSED_APP]: null,
  [Protobuf.Portnums.PortNum.WAYPOINT_APP]: new Protobuf.Mesh.Waypoint(),
  [Protobuf.Portnums.PortNum.AUDIO_APP]: null,
  [Protobuf.Portnums.PortNum.DETECTION_SENSOR_APP]: new TextDecoder(),
  [Protobuf.Portnums.PortNum.REPLY_APP]: new TextDecoder("ascii"),
  [Protobuf.Portnums.PortNum.IP_TUNNEL_APP]: null,
  [Protobuf.Portnums.PortNum.SERIAL_APP]: null,
  [Protobuf.Portnums.PortNum.STORE_FORWARD_APP]:
    new Protobuf.StoreForward.StoreAndForward(),
  [Protobuf.Portnums.PortNum.RANGE_TEST_APP]: new TextDecoder("ascii"),
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
  function DecryptNodeConstructor(this: Node, config: NodeDef): void {
    red.nodes.createNode(this, config);
      
    const node = this;
    const settingsKey = config.key.length > 0 ? config.key : "1PG7OiApB1nwvP+rz05pAQ==";
      
    this.on("input", (msg, send, done) => {
      const jsonWriteOptions = {
        emitDefaultValues: true,
        enumAsInteger: true,
      };

      const packet = msg.payload.packet;
    
      if (packet.encrypted != null) {
        try {
          const key = Buffer.from(settingsKey, "base64");
          const nonceBuffer = createNonce(packet.id, packet.from);

          let algorithm = null;
          if (key.length === 16) {
              algorithm = "aes-128-ctr";
          } else if (key.length === 32) {
              algorithm = "aes-256-ctr";
          } else {
              node.error(`Skipping decryption key with invalid length: ${key.length}`);
          }
          
          if (algorithm) {
            const decipher = crypto.createDecipheriv(algorithm, key, nonceBuffer);
            const decryptedBuffer = Buffer.concat([decipher.update(Buffer.from(packet.encrypted, "base64")), decipher.final()]);

            console.debug('Decrypt', packet.encrypted, 'with key', settingsKey, 'and nonce', nonceBuffer.toString('base64'), 'using', algorithm, 'result', decryptedBuffer.toString('base64'));

            if (decryptedBuffer) {
                try {
                  const decoded = (new Protobuf.Mesh.Data()).fromBinary(decryptedBuffer).toJson(jsonWriteOptions);
                  
                  packet.decoded = decoded;
                
                  const portNum = decoded.portnum;

                  if (decoders[portNum] === null) {
                    console.debug(`No decoder set for portnum ${portNum}`);
                  }
                  else {
                    const payload  = Buffer.from(decoded.payload, 'base64');
                    const decoder = decoders[portNum];

                    if (decoder instanceof TextDecoder) {
                      console.debug("TextDecoder detected. Decoding payload");
                      decoded.payload = decoder.decode(payload);
                    } else {
                      console.debug(
                        "Decoder was not null and not a TextDecoder. Assuming Protobuf decoder and decoding payload",
                      );
                      
                      decoded.payload = decoder
                        .fromBinary(payload)
                        .toJson(jsonWriteOptions);
                    }
                  }

                  console.debug(
                    `Decoded payload to JSON:\n${JSON.stringify(decoded, null, 2)}`,
                  );
                } catch (error) {
                  node.error(`could not decode payload: ${error}`);
                }
            } else {
                node.error("Failed to decrypt the message.");
            }
          }
        } catch (e) {
            console.error(e, "Failed to decrypt", packet.encrypted, "with key", settingsKey);
            node.error("Failed to decrypt due to an error");
        }
      }
              
      send({
        payload: msg.payload,
      });

      done();
    });
  }

  function createNonce(packetId, fromNode) {
    const packetId64 = BigInt(packetId);

    const blockCounter = 0;

    const buf = Buffer.alloc(16);

    buf.writeBigUInt64LE(packetId64, 0);
    buf.writeUInt32LE(fromNode, 8);
    buf.writeUInt32LE(blockCounter, 12);

    return buf;
  }

  red.nodes.registerType("decrypt", DecryptNodeConstructor);
};

export default nodeInit;
