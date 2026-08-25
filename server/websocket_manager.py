# websocket_manager.py - WebSocket for real-time alerts
from fastapi import WebSocket, WebSocketDisconnect
from typing import List, Dict
import json
from datetime import datetime

class ConnectionManager:
    """Manage WebSocket connections for real-time alerts"""

    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.alert_history: List[Dict] = []
        self.max_history = 100

    async def connect(self, websocket: WebSocket):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"🔌 WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """Remove disconnected WebSocket"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"🔌 WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send message to specific client"""
        try:
            await websocket.send_json(message)
        except Exception as e:
            print(f"Error sending message: {e}")

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        # Add to history
        message_with_timestamp = {
            **message,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.alert_history.append(message_with_timestamp)

        # Trim history
        if len(self.alert_history) > self.max_history:
            self.alert_history = self.alert_history[-self.max_history:]

        # Broadcast to all connections
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message_with_timestamp)
            except Exception as e:
                print(f"Error broadcasting: {e}")
                disconnected.append(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast_alert(self, alert: dict):
        """Broadcast a security alert"""
        await self.broadcast({
            "type": "alert",
            "data": alert
        })

    async def broadcast_scan_update(self, scan_data: dict):
        """Broadcast scan status update"""
        await self.broadcast({
            "type": "scan_update",
            "data": scan_data
        })

    async def broadcast_system_status(self, status: dict):
        """Broadcast system status update"""
        await self.broadcast({
            "type": "system_status",
            "data": status
        })

    def get_connection_count(self) -> int:
        """Get number of active connections"""
        return len(self.active_connections)

    def get_alert_history(self, limit: int = 50) -> List[Dict]:
        """Get recent alert history"""
        return self.alert_history[-limit:]


# Global manager instance
manager = ConnectionManager()
