"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { API_BASE } from "@/services/api";

export interface Task {
  title: string;
  durationMinutes: number;
  priority: 'High' | 'Medium' | 'Low';
  deadline?: string;
}

export interface TimetableModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
}

interface ScheduleItem {
  time: string;
  task: string;
  duration: number;
  type: 'work' | 'break';
}

interface GeneratedSchedule {
  schedule: ScheduleItem[];
  message: string;
}

export default function TimetableModal({ isOpen, onClose, userId }: TimetableModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState<Task>({ title: '', durationMinutes: 30, priority: 'Medium' });
  const [availableTime, setAvailableTime] = useState<number>(120); // default 2 hours
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddTask = () => {
    if (!newTask.title.trim() || newTask.durationMinutes <= 0) return;
    setTasks([...tasks, newTask]);
    setNewTask({ title: '', durationMinutes: 30, priority: 'Medium' });
  };

  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (tasks.length === 0) {
      setError("Please add at least one task.");
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    setSchedule(null);
    
    try {
      const res = await fetch(`${API_BASE}/api/timetable/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          tasks: tasks,
          available_time_minutes: availableTime
        })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to generate timetable.");
      }
      
      const data = await res.json();
      setSchedule(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full max-w-2xl bg-[#0c0c0c] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-medium text-white flex items-center gap-2">
              <span className="text-2xl">⚡</span> Smart Timetable Generator
            </h2>
            <p className="text-xs text-gray-400 mt-1">Plan your perfect day around your goals and tasks.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors">
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {schedule ? (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#ADFFA6]/10 border border-[#ADFFA6]/20 text-[#ADFFA6] text-sm">
                {schedule.message}
              </div>
              
              <div className="space-y-3 relative">
                <div className="absolute left-4 top-2 bottom-2 w-px bg-white/10" />
                
                {schedule.schedule.map((item, i) => (
                  <div key={i} className="relative flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 border-[#0c0c0c] z-10 ${item.type === 'break' ? 'bg-gray-700' : 'bg-[#ADFFA6] text-black'}`}>
                      {item.type === 'break' ? '☕' : '✓'}
                    </div>
                    <div className={`flex-1 p-3 rounded-xl border ${item.type === 'break' ? 'border-white/5 bg-white/5' : 'border-white/10 bg-black/40'} flex justify-between items-center`}>
                      <div>
                        <p className={`font-medium ${item.type === 'break' ? 'text-gray-400 text-sm' : 'text-white text-base'}`}>{item.task}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.time} ({item.duration} min)</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setSchedule(null)} className="px-4 py-2 text-sm text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                  Create New
                </button>
                <button onClick={onClose} className="px-4 py-2 text-sm text-black font-semibold bg-[#ADFFA6] hover:bg-[#9af093] rounded-xl transition-colors">
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Available Time (minutes)</label>
                <input 
                  type="number" 
                  value={availableTime} 
                  onChange={(e) => setAvailableTime(parseInt(e.target.value) || 0)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#ADFFA6]/50 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Tasks to Complete</label>
                
                <div className="flex gap-2 mb-4">
                  <input 
                    type="text" 
                    placeholder="Task name" 
                    value={newTask.title}
                    onChange={e => setNewTask({...newTask, title: e.target.value})}
                    onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                    className="flex-1 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#ADFFA6]/50 outline-none"
                  />
                  <input 
                    type="number" 
                    placeholder="Min" 
                    value={newTask.durationMinutes}
                    onChange={e => setNewTask({...newTask, durationMinutes: parseInt(e.target.value) || 0})}
                    className="w-20 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-[#ADFFA6]/50 outline-none"
                  />
                  <select 
                    value={newTask.priority}
                    onChange={e => setNewTask({...newTask, priority: e.target.value as 'High'|'Medium'|'Low'})}
                    className="w-24 bg-black/20 border border-white/10 rounded-xl px-2 py-2 text-white text-sm focus:border-[#ADFFA6]/50 outline-none appearance-none"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Med</option>
                    <option value="Low">Low</option>
                  </select>
                  <button 
                    onClick={handleAddTask}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm transition-colors"
                  >
                    Add
                  </button>
                </div>
                
                <div className="space-y-2">
                  {tasks.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4 border border-dashed border-white/10 rounded-xl">No tasks added yet.</p>
                  ) : (
                    tasks.map((t, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${t.priority === 'High' ? 'bg-red-400' : t.priority === 'Medium' ? 'bg-yellow-400' : 'bg-blue-400'}`} />
                          <span className="text-white text-sm font-medium">{t.title}</span>
                          <span className="text-xs text-gray-500">{t.durationMinutes}m</span>
                        </div>
                        <button onClick={() => handleRemoveTask(idx)} className="text-gray-500 hover:text-red-400 transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm text-center bg-red-400/10 p-3 rounded-xl border border-red-400/20">
                  {error}
                </div>
              )}

              <button 
                onClick={handleGenerate}
                disabled={isGenerating || tasks.length === 0}
                className="w-full mt-4 py-3.5 bg-gradient-to-r from-[#ADFFA6] to-[#B0A8FE] text-black font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full" />
                    Generating...
                  </>
                ) : (
                  "Generate Timetable"
                )}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
