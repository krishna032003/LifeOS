export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export interface StreamCallbacks {
    onPipelineLog?: (node: string, message: string) => void;
    onStateUpdate?: (focus: number, intent: string) => void;
    onFinalResponse?: (message: string, summary: string) => void;
    onError?: (error: string) => void;
    onDone?: () => void;
}

export async function streamAgentChat(userId: string, message: string, commandType: string | undefined, callbacks: StreamCallbacks) {
    try {
        const response = await fetch(`${API_BASE}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, message: message, command_type: commandType || "" }),
        });

        if (!response.ok || !response.body) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const chunks = buffer.split("\n\n");
            buffer = chunks.pop() || ""; // Keep the last incomplete chunk in buffer

            for (const chunk of chunks) {
                if (!chunk.trim()) continue;

                const lines = chunk.split("\n");
                let eventType = "message";
                let dataStr = "";

                for (const line of lines) {
                    if (line.startsWith("event: ")) eventType = line.replace("event: ", "").trim();
                    if (line.startsWith("data: ")) dataStr = line.replace("data: ", "").trim();
                }

                if (dataStr) {
                    try {
                        const data = JSON.parse(dataStr);
                        if (eventType === "pipeline" && callbacks.onPipelineLog) {
                            callbacks.onPipelineLog(data.active_node, data.pipeline_log.message);
                        } else if (eventType === "state" && callbacks.onStateUpdate) {
                            callbacks.onStateUpdate(data.focus_progress, data.intent_detected);
                        } else if (eventType === "message" && data.type === "weekly_review" && callbacks.onFinalResponse) {
                            callbacks.onFinalResponse(dataStr, "");
                        } else if (eventType === "final" && callbacks.onFinalResponse) {
                            callbacks.onFinalResponse(data.message, data.reflection_summary);
                        } else if (eventType === "error" && callbacks.onError) {
                            callbacks.onError(data.error || "Unknown stream error");
                        }
                    } catch (e) {
                        console.error("Failed to parse SSE chunk", dataStr, e);
                    }
                }
            }
        }

        if (callbacks.onDone) callbacks.onDone();

    } catch (error) {
        if (callbacks.onError) callbacks.onError(error instanceof Error ? error.message : "Unknown error");
    }
}
