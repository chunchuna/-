import { joinRoom } from 'trystero/torrent';
import { PeerData } from '../types';

// Configuration
const ROOM_ID = 'alpha_strike_lobby_v1';

class P2PService {
  private room: any;
  private sendStatus: any;
  private onStatus: any;
  private peers: Map<string, PeerData> = new Map();
  private selfData: PeerData = { id: '', name: 'Unknown', highScore: 0, lastSeen: Date.now() };
  private listeners: ((peers: PeerData[]) => void)[] = [];

  constructor() {
    // Singleton initialization could happen here, but we wait for 'init'
  }

  public init(name: string) {
    if (this.room) return; // Already initialized

    try {
      const config = { appId: 'alpha-strike-game' };
      this.room = joinRoom(config, ROOM_ID);
      
      // Actions
      const [sendStatus, onStatus] = this.room.makeAction('status');
      this.sendStatus = sendStatus;
      this.onStatus = onStatus;

      // Self ID (using trystero's selfId if available, or generating one)
      this.selfData.id = this.room.selfId;
      this.selfData.name = name;

      // Handle incoming status
      this.onStatus((data: Partial<PeerData>, peerId: string) => {
        this.peers.set(peerId, {
          id: peerId,
          name: data.name || 'Unknown',
          highScore: data.highScore || 0,
          lastSeen: Date.now()
        });
        this.notifyListeners();
      });

      // Handle peer leaving
      this.room.onPeerLeave((peerId: string) => {
        this.peers.delete(peerId);
        this.notifyListeners();
      });

      // Handle peer joining
      this.room.onPeerJoin((peerId: string) => {
        // Send them our status immediately
        this.broadcastStatus();
      });

      // Periodic broadcast (heartbeat)
      setInterval(() => {
          this.broadcastStatus();
          this.prunePeers();
      }, 5000);

      console.log('P2P Service Initialized for:', name);
    } catch (e) {
      console.error("P2P Init Error:", e);
      // Fail gracefully
    }
  }

  public updateScore(score: number) {
    if (score > this.selfData.highScore) {
      this.selfData.highScore = score;
      this.broadcastStatus();
    }
  }

  private broadcastStatus() {
    if (this.sendStatus) {
      this.sendStatus({
        name: this.selfData.name,
        highScore: this.selfData.highScore
      });
    }
  }

  private prunePeers() {
    const now = Date.now();
    let changed = false;
    this.peers.forEach((peer, id) => {
      if (now - peer.lastSeen > 15000) { // 15s timeout
        this.peers.delete(id);
        changed = true;
      }
    });
    if (changed) this.notifyListeners();
  }

  public subscribe(callback: (peers: PeerData[]) => void) {
    this.listeners.push(callback);
    callback(this.getPeers()); // Initial call
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners() {
    const list = this.getPeers();
    this.listeners.forEach(l => l(list));
  }

  public getPeers(): PeerData[] {
    // Return sorted by score
    return Array.from(this.peers.values()).sort((a, b) => b.highScore - a.highScore);
  }

  public getSelf(): PeerData {
      return this.selfData;
  }
}

export const p2pService = new P2PService();