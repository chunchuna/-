import { joinRoom } from 'trystero/torrent';
import { PeerData, ChatMessage } from '../types';

// Configuration
const ROOM_ID = 'alpha_strike_lobby_v1';

class P2PService {
  private room: any;
  private sendStatus: any;
  private sendChatAction: any;
  private onStatus: any;
  private peers: Map<string, PeerData> = new Map();
  private selfData: PeerData = { id: '', name: 'Unknown', totalScore: 0, lastSeen: Date.now(), status: 'LOBBY' };
  private listeners: ((peers: PeerData[]) => void)[] = [];
  private chatListeners: ((msg: ChatMessage) => void)[] = [];

  constructor() {
    // Singleton initialization
  }

  public init(name: string, initialTotalScore: number) {
    if (this.room) return; // Already initialized

    try {
      const config = { appId: 'alpha-strike-game' };
      this.room = joinRoom(config, ROOM_ID);
      
      // Actions
      const [sendStatus, onStatus] = this.room.makeAction('status');
      const [sendChat, onChat] = this.room.makeAction('chat');

      this.sendStatus = sendStatus;
      this.onStatus = onStatus;
      this.sendChatAction = sendChat;

      // Self ID 
      this.selfData.id = this.room.selfId;
      this.selfData.name = name;
      this.selfData.totalScore = initialTotalScore;

      // Handle incoming status
      this.onStatus((data: Partial<PeerData>, peerId: string) => {
        this.peers.set(peerId, {
          id: peerId,
          name: data.name || 'Unknown',
          totalScore: data.totalScore || 0,
          lastSeen: Date.now(),
          status: data.status,
          currentScore: data.currentScore,
          currentTime: data.currentTime
        });
        this.notifyListeners();
      });

      // Handle incoming chat
      onChat((data: any, peerId: string) => {
        const peer = this.peers.get(peerId);
        const name = peer ? peer.name : 'Unknown Agent';
        const msg: ChatMessage = {
          id: data.id,
          senderId: peerId,
          senderName: name,
          text: data.text,
          timestamp: data.timestamp
        };
        this.notifyChatListeners(msg);
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

      console.log('Network Service Initialized for:', name);
    } catch (e) {
      console.error("Network Init Error:", e);
    }
  }

  public updateTotalScore(newTotal: number) {
    this.selfData.totalScore = newTotal;
    this.broadcastStatus();
  }

  public updateGameStatus(status: 'LOBBY' | 'PLAYING', currentScore: number = 0, currentTime: number = 0) {
    this.selfData.status = status;
    this.selfData.currentScore = currentScore;
    this.selfData.currentTime = currentTime;
    this.broadcastStatus();
  }

  public sendMessage(text: string) {
    if (!this.sendChatAction) return;
    
    const msgPayload = {
      id: Math.random().toString(36).substr(2, 9),
      text: text,
      timestamp: Date.now()
    };
    
    this.sendChatAction(msgPayload);
    
    // Notify self
    const fullMsg: ChatMessage = {
      id: msgPayload.id,
      senderId: this.selfData.id,
      senderName: this.selfData.name,
      text: msgPayload.text,
      timestamp: msgPayload.timestamp
    };
    this.notifyChatListeners(fullMsg);
  }

  private broadcastStatus() {
    if (this.sendStatus) {
      this.sendStatus({
        name: this.selfData.name,
        totalScore: this.selfData.totalScore,
        status: this.selfData.status,
        currentScore: this.selfData.currentScore,
        currentTime: this.selfData.currentTime
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

  public subscribeChat(callback: (msg: ChatMessage) => void) {
    this.chatListeners.push(callback);
    return () => {
      this.chatListeners = this.chatListeners.filter(l => l !== callback);
    };
  }

  private notifyListeners() {
    const list = this.getPeers();
    this.listeners.forEach(l => l(list));
  }

  private notifyChatListeners(msg: ChatMessage) {
    this.chatListeners.forEach(l => l(msg));
  }

  public getPeers(): PeerData[] {
    // Return sorted by total score
    return Array.from(this.peers.values()).sort((a, b) => b.totalScore - a.totalScore);
  }

  public getSelf(): PeerData {
      return this.selfData;
  }
}

export const p2pService = new P2PService();