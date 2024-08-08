import { WebSocket } from '@cloudflare/workers-types';

import debug from 'debug';
const log = debug('WorkerWebSocket');

import { cbor as cborHelpers, NetworkAdapter, type PeerId, type PeerMetadata } from '@automerge/automerge-repo';
import { assert } from './assert.js';
import { handleChunked, sendChunked } from './chunking.js';
import { FromClientMessage, FromServerMessage, isJoinMessage, isLeaveMessage } from './messages.js';
import { ProtocolV1, ProtocolVersion } from './protocolVersion.js';
import { toArrayBuffer } from './toArrayBuffer.js';

const { encode, decode } = cborHelpers;

/**
 * Worker only handles one WebSocket.
 */
export class WorkerWebSocketAdapter extends NetworkAdapter {
	remotePeerId?: PeerId; // this adapter only connects to one remote client at a time

	clients = new Set();

	constructor(private readonly socket: WebSocket) {
		super();
	}

	connect(peerId: PeerId, peerMetadata?: PeerMetadata) {
		this.peerId = peerId;
		this.peerMetadata = peerMetadata;

		this.clients.add(peerId);
		console.log('clients', Array.from(this.clients.values()));

		const socket = this.socket;

		socket.addEventListener('close', () => {
			this.disconnect();
		});

		socket.addEventListener(
			'message',
			handleChunked(message => this.receiveMessage(message as Uint8Array))
		);
		this.emit('ready', { network: this });
	}

	disconnect() {
		const socket = this.socket;
		this.#terminate(socket);
	}

	send(message: FromServerMessage) {
		assert('targetId' in message && message.targetId !== undefined);
		if ('data' in message && message.data?.byteLength === 0) throw new Error('Tried to send a zero-length message');

		const senderId = this.peerId;
		assert(senderId, 'No peerId set for the websocket server network adapter.');

		const socket = this.socket;
		if (!socket) {
			log(`Tried to send to disconnected peer: ${message.targetId}`);
			return;
		}

		const encoded = encode(message);
		const arrayBuf = toArrayBuffer(encoded);

		sendChunked(arrayBuf, socket);
	}

	receiveMessage(messageBytes: Uint8Array) {
		const socket = this.socket;
		const message: FromClientMessage = decode(messageBytes);

		const { type, senderId } = message;

		const myPeerId = this.peerId;
		assert(myPeerId);

		const documentId = 'documentId' in message ? '@' + message.documentId : '';
		const { byteLength } = messageBytes;
		log(`[${senderId}->${myPeerId}${documentId}] ${type} | ${byteLength} bytes`);

		if (isJoinMessage(message)) {
			const { peerMetadata, supportedProtocolVersions } = message;

			// Let the repo know that we have a new connection.
			this.emit('peer-candidate', { peerId: senderId, peerMetadata });
			this.remotePeerId = senderId;

			const selectedProtocolVersion = selectProtocol(supportedProtocolVersions);
			if (selectedProtocolVersion === null) {
				this.send({
					type: 'error',
					senderId: this.peerId!,
					message: 'unsupported protocol version',
					targetId: senderId,
				});
				socket.close();
			} else {
				this.send({
					type: 'peer',
					senderId: this.peerId!,
					peerMetadata: this.peerMetadata!,
					selectedProtocolVersion,
					targetId: senderId,
				});
			}
		} else if (isLeaveMessage(message)) {
			const socket = this.socket;
			this.#terminate(socket);
		} else {
			this.emit('message', message);
		}
	}

	#terminate(socket: WebSocket) {
		this.emit('peer-disconnected', { peerId: this.remotePeerId });
	}
}

const selectProtocol = (versions?: ProtocolVersion[]) => {
	if (versions === undefined) return ProtocolV1;
	if (versions.includes(ProtocolV1)) return ProtocolV1;
	return null;
};
