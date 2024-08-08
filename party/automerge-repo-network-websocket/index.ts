/**
 * A `NetworkAdapter` which connects to a remote host via WebSockets
 *
 * The websocket protocol requires a server to be listening and a client to
 * connect to the server. To that end the {@link NodeWSServerAdapter} does not
 * make outbound connections and instead listens on the provided socket for
 * new connections whilst the {@link BrowserWebSocketClientAdapter} makes an
 * outbound connection to the provided socket.
 *
 * Note that the "browser" and "node" naming is a bit misleading, both
 * implementations work in both the browser and on node via `isomorphic-ws`.
 *
 * @module
 * */
export { BrowserWebSocketClientAdapter } from './BrowserWebSocketClientAdapter.js';
export type {
	ErrorMessage,
	FromClientMessage,
	FromServerMessage,
	JoinMessage,
	LeaveMessage,
	PeerMessage,
} from './messages.js';
export { NodeWSServerAdapter } from './NodeWSServerAdapter.js';
export { ProtocolV1 } from './protocolVersion.js';
export type { ProtocolVersion } from './protocolVersion.js';
