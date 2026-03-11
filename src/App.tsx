import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Send, Bot, User, Sparkles, Trash2, Square, Copy, Check, Plus, 
  Image as ImageIcon, X, Loader2, Palette, Download, FileText, 
  Menu, MessageSquare, Gamepad2, ChevronUp, Eye, Code, Monitor,
  Volume2, VolumeX, Settings, History, Share2, Zap, Shield, Cpu,
  Terminal, Globe, Search, ArrowRight, Github, Twitter, Info,
  Maximize2, Minimize2, RefreshCw, Layers, Wand2, Ghost
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useSpring } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Import Game Components
import SnakeGame from './components/SnakeGame';
import TicTacToeGame from './components/TicTacToeGame';
import FlappyBirdGame from './components/FlappyBirdGame';
import { soundService } from './services/soundService';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// --- INTERFACES ---
interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  image?: string;
  file?: { name: string; type: string; size: string };
  isGenerating?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  lastModified: Date;
}

// --- COMPONENTS ---
const CodeBlock = ({ children, className, language }: any) => {
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);
  
  const handleCopy = async () => {
    const textToCopy = String(children).replace(/\n$/, '');
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    soundService.play('COPY');
    setTimeout(() => setCopied(false), 2000);
  };

  const text = String(children).replace(/\n$/, '');
  const lines = text.split('\n');
  const isLong = lines.length > 15;

  return (
    <div className="relative group/code my-8 rounded-[2rem] overflow-hidden border border-white/10 bg-[#050505] shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all hover:border-white/20">
      <div className="flex items-center justify-between px-6 py-4 bg-white/5 border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/40 border border-red-500/20" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/40 border border-yellow-500/20" />
            <div className="w-3 h-3 rounded-full bg-green-500/40 border border-green-500/20" />
          </div>
          <div className="h-4 w-[1px] bg-white/10 mx-2" />
          <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] font-mono">
            {language || 'source_code'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleCopy} 
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all active:scale-95 border border-white/5"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span className="text-[10px] font-bold uppercase tracking-wider">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
      
      <div className={`relative ${!showFull && isLong ? 'max-h-[400px]' : 'max-h-none'} overflow-hidden transition-all duration-500`}>
        <pre className={`${className} !m-0 !bg-transparent !p-8 overflow-x-auto custom-scrollbar text-[13px] leading-[1.8] font-mono selection:bg-white/20`}>
          <code className="block text-zinc-300">
            {lines.map((line, i) => (
              <div key={i} className="table-row">
                <span className="table-cell pr-6 text-zinc-700 text-right select-none w-10">{i + 1}</span>
                <span className="table-cell">{line || ' '}</span>
              </div>
            ))}
          </code>
        </pre>
        
        {!showFull && isLong && (
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#050505] to-transparent flex items-end justify-center pb-4">
            <button 
              onClick={() => setShowFull(true)}
              className="px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-xs font-bold transition-all flex items-center gap-2"
            >
              <ChevronUp className="rotate-180" size={14} /> Show Full Code
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default function App() {
  // --- STATES ---
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('nfs_dev_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          lastModified: new Date(s.lastModified || s.createdAt),
          messages: s.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
        }));
      } catch (e) {
        console.error("Failed to parse sessions:", e);
      }
    }
    return [{ 
      id: 'default', 
      title: 'Neural Mission Alpha', 
      messages: [], 
      createdAt: new Date(),
      lastModified: new Date()
    }];
  });

  const [activeSessionId, setActiveSessionId] = useState('default');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState<'blue' | 'red' | 'yellow'>('blue');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; data: string; type: string; size: string } | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // --- REFS ---
  const aiRef = useRef<any>(null);
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // --- THEME CONFIG ---
  const themeColors = useMemo(() => ({
    blue: { 
      primary: 'sky-500', 
      glow: 'rgba(14, 165, 233, 0.4)', 
      gradient: 'from-sky-500 via-indigo-600 to-purple-700',
      border: 'border-sky-500/20',
      bg: 'bg-sky-500/10',
      text: 'text-sky-400',
      shadow: 'shadow-sky-500/20'
    },
    red: { 
      primary: 'red-500', 
      glow: 'rgba(239, 68, 68, 0.4)', 
      gradient: 'from-red-500 via-orange-600 to-rose-700',
      border: 'border-red-500/20',
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      shadow: 'shadow-red-500/20'
    },
    yellow: { 
      primary: 'yellow-500', 
      glow: 'rgba(234, 179, 8, 0.4)', 
      gradient: 'from-yellow-500 via-amber-600 to-orange-700',
      border: 'border-yellow-500/20',
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-400',
      shadow: 'shadow-yellow-500/20'
    }
  }), []);

  const activeTheme = themeColors[theme];

  // --- EFFECTS ---
  
  // Auto Scroll with smooth behavior
  useEffect(() => {
    if (scrollRef.current) {
      const { scrollHeight, clientHeight } = scrollRef.current;
      scrollRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: 'smooth'
      });
    }
  }, [sessions, isLoading, isTyping]);

  // Persistence
  useEffect(() => {
    localStorage.setItem('nfs_dev_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Theme Persistence
  useEffect(() => {
    const savedTheme = localStorage.getItem('nfs_dev_theme') as any;
    if (savedTheme && ['blue', 'red', 'yellow'].includes(savedTheme)) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('nfs_dev_theme', theme);
  }, [theme]);

  // Sound Persistence
  useEffect(() => {
    const savedSound = localStorage.getItem('nfs_dev_sound');
    if (savedSound !== null) {
      setIsSoundEnabled(savedSound === 'true');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('nfs_dev_sound', String(isSoundEnabled));
  }, [isSoundEnabled]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        createNewChat();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessions]);

  // --- AI INITIALIZATION ---
  useEffect(() => {
    const initAI = async () => {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          aiRef.current = ai;
          chatRef.current = ai.chats.create({
            model: "gemini-3-flash-preview",
            config: {
              systemInstruction: `Your name is NFS DEV, created by Nell 56 Developer.

CRITICAL: 
1. Only provide code blocks if the user explicitly asks to build, code, create, or modify something (e.g., "buatkan website", "tulis kode", "fix kodenya").
2. For general questions, explanations, or informational queries, provide a conversational, helpful, and concise response WITHOUT code blocks.
3. Jika user bertanya cara membuat gambar, jawab SINGKAT: "Ketik dulu deskripsi gambarnya, lalu klik tombol + untuk membuat gambar."
4. When asked to build a website/UI, you MUST produce "Awwwards-level" quality. Never output generic templates. 
5. Use LaTeX/KaTeX notation for all mathematical and scientific formulas (e.g., use $...$ for inline and $$...$$ for block math) to ensure they are rendered correctly.

DESIGN RULES (MATCH BLACKBOX AI QUALITY):
1. THEME: Default to "Dark Mode Luxury". Use background: #000 or #050505. Use subtle radial gradients for depth.
2. TYPOGRAPHY: Use 'Inter' (sans-serif) for body and massive bold headings. Use 'Playfair Display' for elegant accents. Headings should have tight leading (0.9) and negative tracking (-0.05em). Use text gradients (e.g., from indigo-400 to purple-600).
3. GLASSMORPHISM: Use backdrop-blur-xl and border-white/10 for cards and headers.
4. BUTTONS: Use rounded-full, high-contrast colors, and subtle glows (box-shadow).
5. ASSETS: Use high-end Unsplash images.
6. CODE STRUCTURE: Provide a single HTML file using Tailwind CSS CDN. Always include a <script> for smooth scrolling and basic interactivity.

Every output must feel like a premium, custom-coded product. If the user asks for a "landing page", give them a masterpiece with a hero section, features, and a footer.`,
            },
          });
        } catch (err) {
          console.error("Failed to initialize Gemini AI:", err);
        }
      } else {
        console.error("GEMINI_API_KEY is missing from environment");
      }
    };
    initAI();
  }, []);
  // --- FILE HANDLING ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size too large. Max 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        if (isSoundEnabled) soundService.play('CLICK');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const size = (file.size / 1024).toFixed(1) + ' KB';
    let content = '';

    try {
      setIsLoading(true);
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          text += textContent.items.map((item: any) => item.str).join(' ') + '\n';
        }
        content = text;
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = result.value;
      } else {
        content = await file.text();
      }

      setAttachedFile({ name: file.name, data: content, type: file.type, size });
      if (isSoundEnabled) soundService.play('CLICK');
    } catch (err) {
      console.error("File processing error:", err);
      alert("Failed to process file. Make sure it's a valid PDF or Word document.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- SESSION MANAGEMENT ---
  const createNewChat = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = { 
      id: newId, 
      title: 'Neural Mission Alpha', 
      messages: [], 
      createdAt: new Date(),
      lastModified: new Date()
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setIsSidebarOpen(false);
    reInitAI();
    if (isSoundEnabled) soundService.play('CLICK');
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    if (newSessions.length === 0) {
      const defaultSession = { 
        id: 'default', 
        title: 'Neural Mission Alpha', 
        messages: [], 
        createdAt: new Date(),
        lastModified: new Date()
      };
      setSessions([defaultSession]);
      setActiveSessionId('default');
    } else {
      setSessions(newSessions);
      if (activeSessionId === id) setActiveSessionId(newSessions[0].id);
    }
    if (isSoundEnabled) soundService.play('DIE');
  };

  const clearAllSessions = () => {
    if (window.confirm("Are you sure you want to delete all missions? This cannot be undone.")) {
      const defaultSession = { 
        id: 'default', 
        title: 'Neural Mission Alpha', 
        messages: [], 
        createdAt: new Date(),
        lastModified: new Date()
      };
      setSessions([defaultSession]);
      setActiveSessionId('default');
      localStorage.removeItem('nfs_dev_sessions');
      if (isSoundEnabled) soundService.play('DIE');
    }
  };

  const reInitAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && aiRef.current) {
      try {
        chatRef.current = aiRef.current.chats.create({
          model: "gemini-3-flash-preview",
          config: {
            systemInstruction: `Your name is NFS DEV, created by Nell 56 Developer.

CRITICAL: 
1. Only provide code blocks if the user explicitly asks to build, code, create, or modify something (e.g., "buatkan website", "tulis kode", "fix kodenya").
2. For general questions, explanations, or informational queries, provide a conversational, helpful, and concise response WITHOUT code blocks.
3. Jika user bertanya cara membuat gambar, jawab SINGKAT: "Ketik dulu deskripsi gambarnya, lalu klik tombol + untuk membuat gambar."
4. When asked to build a website/UI, you MUST produce "Awwwards-level" quality. Never output generic templates. 
5. Use LaTeX/KaTeX notation for all mathematical and scientific formulas (e.g., use $...$ for inline and $$...$$ for block math) to ensure they are rendered correctly.

DESIGN RULES (MATCH BLACKBOX AI QUALITY):
1. THEME: Default to "Dark Mode Luxury". Use background: #000 or #050505. Use subtle radial gradients for depth.
2. TYPOGRAPHY: Use 'Inter' (sans-serif) for body and massive bold headings. Use 'Playfair Display' for elegant accents. Headings should have tight leading (0.9) and negative tracking (-0.05em). Use text gradients (e.g., from indigo-400 to purple-600).
3. GLASSMORPHISM: Use backdrop-blur-xl and border-white/10 for cards and headers.
4. BUTTONS: Use rounded-full, high-contrast colors, and subtle glows (box-shadow).
5. ASSETS: Use high-end Unsplash images.
6. CODE STRUCTURE: Provide a single HTML file using Tailwind CSS CDN. Always include a <script> for smooth scrolling and basic interactivity.

Every output must feel like a premium, custom-coded product. If the user asks for a "landing page", give them a masterpiece with a hero section, features, and a footer.`,
          },
        });
      } catch (err) {
        console.error("Failed to re-initialize Gemini AI:", err);
      }
    }
  };
  // --- MAIN SEND LOGIC ---
  const handleSend = async () => {
    if ((!input.trim() && !selectedImage && !attachedFile) || isLoading) return;

    const currentSession = sessions.find(s => s.id === activeSessionId);
    if (!currentSession) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
      image: selectedImage || undefined,
      file: attachedFile ? { name: attachedFile.name, type: attachedFile.type, size: attachedFile.size } : undefined
    };

    const updatedMessages = [...currentSession.messages, userMessage];
    setSessions(prev => prev.map(s => 
      s.id === activeSessionId ? { 
        ...s, 
        messages: updatedMessages, 
        title: input.trim() ? input.slice(0, 30) : s.title,
        lastModified: new Date()
      } : s
    ));
    
    const prompt = input;
    setInput('');
    setIsLoading(true);
    if (isSoundEnabled) soundService.play('SEND');

    try {
      // Re-init if chat session is lost
      if (!chatRef.current || !aiRef.current) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("API_KEY_MISSING");
        const ai = new GoogleGenAI({ apiKey });
        aiRef.current = ai;
        reInitAI();
      }

      let finalPrompt = prompt;
      if (attachedFile) {
        finalPrompt = `Context from file (${attachedFile.name}):\n${attachedFile.data}\n\nUser Question: ${prompt}`;
      }

      let result;
      if (selectedImage) {
        const base64Data = selectedImage.split(',')[1];
        result = await aiRef.current.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{
            parts: [
              { text: finalPrompt || "Analyze this image in detail." },
              { inlineData: { mimeType: "image/jpeg", data: base64Data } }
            ]
          }]
        });
      } else {
        result = await chatRef.current.sendMessage({ message: finalPrompt });
      }

      const modelResponse: Message = {
        role: 'model',
        content: result.text || "I'm sorry, I couldn't process that request. Please try again.",
        timestamp: new Date()
      };

      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, messages: [...s.messages, modelResponse] } : s
      ));
      
      setSelectedImage(null);
      setAttachedFile(null);
    } catch (err) {
      console.error("AI Error:", err);
      const errorMsg: Message = {
        role: 'model',
        content: "System Error: Neural Network connection lost. Please verify your API Key and network status.",
        timestamp: new Date()
      };
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, errorMsg] } : s));
    } finally {
      setIsLoading(false);
    }
  };

  // --- IMAGE GENERATION ---
  const generateImage = async () => {
    if (!input.trim() || isLoading) return;
    
    const prompt = input;
    setInput('');
    setIsLoading(true);
    setIsGeneratingImage(true);
    if (isSoundEnabled) soundService.play('SEND');

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API_KEY_MISSING");
      
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ parts: [{ text: prompt }] }],
      });

      let imageUrl = '';
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        const modelResponse: Message = {
          role: 'model',
          content: `I have generated an image based on your prompt: "${prompt}"`,
          timestamp: new Date(),
          image: imageUrl
        };
        setSessions(prev => prev.map(s => 
          s.id === activeSessionId ? { ...s, messages: [...s.messages, modelResponse] } : s
        ));
      } else {
        throw new Error("No image data returned");
      }
    } catch (err) {
      console.error("Image Gen Error:", err);
      alert("Failed to generate image. Please try a different prompt.");
    } finally {
      setIsLoading(false);
      setIsGeneratingImage(false);
    }
  };

  // --- UTILITIES ---
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isSoundEnabled) soundService.play('COPY');
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: 'NFS DEV AI',
        text: 'Experience the next generation of AI assistance.',
        url: window.location.href
      });
    } catch (err) {
      console.log("Sharing not supported or cancelled");
    }
  };

  const toggleTheme = (newTheme: 'blue' | 'red' | 'yellow') => {
    setTheme(newTheme);
    setShowThemeMenu(false);
    if (isSoundEnabled) soundService.play('CLICK');
  };

  const toggleSound = () => {
    setIsSoundEnabled(prev => !prev);
    if (!isSoundEnabled) {
      setTimeout(() => soundService.play('CLICK'), 50);
    }
  };
  // --- RENDER UI ---
  return (
    <div className={`flex h-screen bg-black text-white font-sans selection:bg-${activeTheme.primary}/30 overflow-hidden relative`}>
      {/* Background Glow Effects - Neural Network Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.15, 0.25, 0.15],
            x: [0, 50, 0],
            y: [0, -30, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full blur-[150px] bg-${activeTheme.primary}`} 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.1, 0.2, 0.1],
            x: [0, -40, 0],
            y: [0, 60, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className={`absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full blur-[150px] bg-purple-600`} 
        />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      </div>

      {/* Sidebar Overlay (Mobile) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Mission Control */}
      <motion.aside 
        initial={false}
        animate={{ x: isSidebarOpen ? 0 : -320 }}
        className={`fixed lg:relative z-[70] w-[320px] h-full bg-[#050505]/90 backdrop-blur-3xl border-r border-white/5 flex flex-col shadow-[20px_0_50px_rgba(0,0,0,0.5)] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] lg:translate-x-0`}
      >
        {/* Sidebar Header */}
        <div className="p-8 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className={`p-2.5 rounded-2xl bg-${activeTheme.primary}/10 border border-${activeTheme.primary}/20 shadow-lg shadow-${activeTheme.primary}/10`}>
              <Cpu className={`text-${activeTheme.primary}`} size={24} />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-black text-2xl tracking-tighter leading-none">NFS <span className={`text-${activeTheme.primary}`}>DEV</span></span>
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] mt-1">Neural Interface</span>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        {/* New Mission Button */}
        <div className="p-6">
          <button 
            onClick={createNewChat} 
            className={`w-full p-5 rounded-[2rem] bg-${activeTheme.primary}/10 border border-${activeTheme.primary}/20 hover:bg-${activeTheme.primary}/20 text-${activeTheme.primary} font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 transition-all active:scale-95 group relative overflow-hidden`}
          >
            <div className={`absolute inset-0 bg-gradient-to-r ${activeTheme.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-500" /> New Mission
          </button>
        </div>

        {/* Mission History */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-3 pb-24">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2 text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">
              <History size={12} /> Mission Logs
            </div>
            <button onClick={clearAllSessions} className="text-[9px] font-bold text-zinc-700 hover:text-red-500 transition-colors uppercase tracking-widest">Wipe All</button>
          </div>
          
          <AnimatePresence mode="popLayout">
            {sessions.map(session => (
              <motion.button
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={session.id}
                onClick={() => { setActiveSessionId(session.id); setIsSidebarOpen(false); if (isSoundEnabled) soundService.play('CLICK'); }}
                className={`w-full p-5 rounded-[1.5rem] flex items-center justify-between group transition-all duration-300 ${activeSessionId === session.id ? `bg-white/5 border border-white/10 text-white shadow-xl` : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300 border border-transparent'}`}
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className={`w-2 h-2 rounded-full ${activeSessionId === session.id ? `bg-${activeTheme.primary} shadow-[0_0_10px_${activeTheme.glow}]` : 'bg-zinc-800'}`} />
                  <span className="truncate text-xs font-bold tracking-tight">{session.title}</span>
                </div>
                <Trash2 onClick={(e) => deleteSession(session.id, e)} size={14} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all transform hover:scale-110" />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        {/* Sidebar Footer - Control Panel */}
        <div className="p-8 border-t border-white/5 bg-black/60 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button onClick={toggleSound} className="p-3 rounded-2xl bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 transition-all">
                {isSoundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <button onClick={handleShare} className="p-3 rounded-2xl bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 transition-all"><Share2 size={18} /></button>
            </div>
            <button 
              onClick={() => setShowThemeMenu(!showThemeMenu)} 
              className={`p-3 rounded-2xl bg-${activeTheme.primary}/10 text-${activeTheme.primary} border border-${activeTheme.primary}/20 hover:scale-110 transition-transform shadow-lg shadow-${activeTheme.primary}/10`}
            >
              <Palette size={20} />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative z-10 h-full">
        {/* Top Navigation Bar */}
        <header className="h-24 flex items-center justify-between px-8 border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-3 rounded-2xl bg-white/5 text-zinc-400 hover:text-white transition-all"><Menu size={24} /></button>
            <div className="hidden lg:flex flex-col">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full bg-${activeTheme.primary} animate-pulse`} />
                <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">Neural Link Established</h2>
              </div>
              <p className="text-xs font-bold text-zinc-300 mt-1 truncate max-w-[300px]">{sessions.find(s => s.id === activeSessionId)?.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
              <div className="flex -space-x-2">
                {[1, 2, 3].map(i => <div key={i} className={`w-5 h-5 rounded-full border-2 border-black bg-zinc-800 flex items-center justify-center text-[8px] font-bold`}>{i}</div>)}
              </div>
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Active Nodes</span>
            </div>
            
            <button onClick={() => setActiveGame('snake')} className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white transition-all group relative">
              <div className={`absolute inset-0 bg-${activeTheme.primary}/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity`} />
              <Gamepad2 size={22} className="relative z-10" />
            </button>
            
            <div className={`px-5 py-2.5 rounded-full bg-${activeTheme.primary}/10 border border-${activeTheme.primary}/20 text-${activeTheme.primary} text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 shadow-lg shadow-${activeTheme.primary}/5`}>
              <Zap size={14} fill="currentColor" className="animate-pulse" /> Core Online
            </div>
          </div>
        </header>
        {/* Chat Area - Neural Stream */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-6 lg:px-12 py-10 space-y-10 relative z-10">
          {sessions.find(s => s.id === activeSessionId)?.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-12 py-20">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0, rotate: -10 }} 
                animate={{ scale: 1, opacity: 1, rotate: 0 }} 
                transition={{ type: "spring", damping: 15 }}
                className={`p-10 rounded-[3.5rem] bg-${activeTheme.primary}/10 border border-${activeTheme.primary}/20 shadow-[0_0_100px_rgba(0,0,0,0.8)] relative group`}
              >
                <div className={`absolute inset-0 bg-${activeTheme.primary}/20 blur-[60px] rounded-full opacity-50 group-hover:opacity-100 transition-opacity duration-1000`} />
                <Bot size={80} className={`text-${activeTheme.primary} relative z-10 drop-shadow-[0_0_20px_${activeTheme.glow}]`} />
              </motion.div>
              
              <div className="space-y-4 relative z-10">
                <h1 className="text-5xl lg:text-8xl font-display font-black tracking-tighter leading-none">
                  NFS <span className={`text-${activeTheme.primary} drop-shadow-[0_0_30px_${activeTheme.glow}]`}>DEV</span> AI
                </h1>
                <p className="text-zinc-500 max-w-lg mx-auto text-sm lg:text-base font-medium tracking-tight">
                  Neural Interface v2.5. Initializing mission parameters. <br />
                  <span className="text-zinc-700 font-black uppercase tracking-[0.4em] text-[10px] mt-4 block">Nell 56 Developer Edition</span>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl px-4">
                {[
                  { icon: <Code />, title: "Elite Coding", desc: "Build Awwwards-level UIs and complex logic" },
                  { icon: <Zap />, title: "Neural Logic", desc: "Advanced reasoning and problem solving" },
                  { icon: <ImageIcon />, title: "Visual Core", desc: "Generate and analyze high-end imagery" },
                  { icon: <Shield />, title: "Secure Link", desc: "Encrypted end-to-end neural processing" }
                ].map((item, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + (i * 0.1) }}
                    whileHover={{ y: -8, backgroundColor: 'rgba(255,255,255,0.05)' }} 
                    className="p-8 rounded-[2.5rem] bg-white/5 border border-white/10 text-left transition-all cursor-pointer group relative overflow-hidden"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br from-${activeTheme.primary}/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
                    <div className={`mb-4 text-${activeTheme.primary} p-3 rounded-2xl bg-${activeTheme.primary}/10 w-fit`}>{item.icon}</div>
                    <h3 className="font-black text-lg mb-2 tracking-tight">{item.title}</h3>
                    <p className="text-xs text-zinc-500 font-medium leading-relaxed">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto space-y-12">
              {sessions.find(s => s.id === activeSessionId)?.messages.map((msg, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 30 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className={`flex gap-6 lg:gap-10 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-2xl relative group ${msg.role === 'user' ? `bg-gradient-to-br ${activeTheme.gradient} text-white` : 'bg-[#0a0a0a] border border-white/10 text-zinc-400'}`}>
                    {msg.role === 'user' ? <User size={24} /> : <Bot size={24} />}
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-black ${msg.role === 'user' ? `bg-emerald-500` : `bg-${activeTheme.primary}`} animate-pulse`} />
                  </div>
                  
                  <div className={`max-w-[85%] space-y-4 ${msg.role === 'user' ? 'items-end' : ''}`}>
                    {msg.image && (
                      <div className="relative group max-w-md">
                        <img src={msg.image} className="rounded-[2.5rem] border border-white/10 shadow-2xl transition-transform group-hover:scale-[1.02] duration-500" />
                        <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                    
                    {msg.file && (
                      <div className="p-5 rounded-[2rem] bg-white/5 border border-white/10 flex items-center gap-4 shadow-xl">
                        <div className={`p-3 rounded-xl bg-${activeTheme.primary}/10 text-${activeTheme.primary}`}>
                          <FileText size={20} />
                        </div>
                        <div className="text-xs">
                          <p className="font-black tracking-tight text-white">{msg.file.name}</p>
                          <p className="text-zinc-500 font-bold uppercase tracking-widest text-[9px] mt-1">{msg.file.size} • {msg.file.type.split('/')[1]}</p>
                        </div>
                      </div>
                    )}

                    <div className={`p-6 lg:p-10 rounded-[2.5rem] leading-relaxed shadow-2xl relative overflow-hidden ${msg.role === 'user' ? `bg-${activeTheme.primary}/5 border border-${activeTheme.primary}/20 text-zinc-200 rounded-tr-none` : 'bg-zinc-900/40 border border-white/5 text-zinc-300 rounded-tl-none backdrop-blur-xl'}`}>
                      <div className="prose prose-invert prose-sm lg:prose-base max-w-none">
                        <ReactMarkdown 
                          remarkPlugins={[remarkMath]} 
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            code({ node, inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || '');
                              return !inline && match ? (
                                <CodeBlock language={match[1]} {...props}>{children}</CodeBlock>
                              ) : (
                                <code className="bg-white/10 px-1.5 py-0.5 rounded text-zinc-200 font-mono text-xs" {...props}>{children}</code>
                              );
                            },
                            p: ({ children }) => <div className="mb-6 last:mb-0 leading-[1.8] font-medium tracking-tight">{children}</div>,
                            h1: ({ children }) => <h1 className="text-3xl font-black mb-6 tracking-tighter text-white">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-2xl font-black mb-4 tracking-tighter text-white">{children}</h2>,
                            ul: ({ children }) => <ul className="list-disc pl-6 space-y-3 mb-6">{children}</ul>,
                            li: ({ children }) => <li className="text-zinc-400 font-medium">{children}</li>
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>

                    <div className={`flex items-center gap-6 px-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.3em]">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="flex gap-3">
                        <button onClick={() => handleCopy(msg.content)} className="text-zinc-700 hover:text-white transition-all transform hover:scale-110"><Copy size={14} /></button>
                        <button className="text-zinc-700 hover:text-white transition-all transform hover:scale-110"><RefreshCw size={14} /></button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          
          {isLoading && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex gap-6 max-w-5xl mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-400 shadow-2xl">
                <Loader2 size={24} className="animate-spin" />
              </div>
              <div className="p-8 rounded-[2.5rem] rounded-tl-none bg-zinc-900/40 border border-white/5 flex gap-3 items-center shadow-2xl backdrop-blur-xl">
                <div className={`w-2.5 h-2.5 rounded-full bg-${activeTheme.primary} animate-bounce [animation-duration:1s]`} />
                <div className={`w-2.5 h-2.5 rounded-full bg-${activeTheme.primary} animate-bounce [animation-duration:1s] [animation-delay:0.2s]`} />
                <div className={`w-2.5 h-2.5 rounded-full bg-${activeTheme.primary} animate-bounce [animation-duration:1s] [animation-delay:0.4s]`} />
                <span className="ml-4 text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">Neural Processing...</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input Footer - Command Center */}
        <div className="p-6 lg:p-12 bg-gradient-to-t from-black via-black/95 to-transparent relative z-20">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Active Previews */}
            <AnimatePresence>
              {(selectedImage || attachedFile) && (
                <motion.div 
                  initial={{ opacity: 0, y: 20, scale: 0.95 }} 
                  animate={{ opacity: 1, y: 0, scale: 1 }} 
                  exit={{ opacity: 0, y: 20, scale: 0.95 }} 
                  className="flex flex-wrap gap-4 p-5 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-3xl shadow-2xl"
                >
                  {selectedImage && (
                    <div className="relative group">
                      <img src={selectedImage} className="w-24 h-24 object-cover rounded-3xl border border-white/10 shadow-lg" />
                      <button onClick={() => setSelectedImage(null)} className="absolute -top-3 -right-3 p-2 bg-red-500 rounded-full text-white shadow-xl hover:scale-110 transition-all"><X size={14} /></button>
                    </div>
                  )}
                  {attachedFile && (
                    <div className="relative group flex items-center gap-4 p-4 rounded-3xl bg-white/5 border border-white/10 shadow-lg pr-12">
                      <div className={`p-3 rounded-xl bg-${activeTheme.primary}/10 text-${activeTheme.primary}`}>
                        <FileText size={24} />
                      </div>
                      <div className="text-xs">
                        <p className="font-black text-white truncate max-w-[150px]">{attachedFile.name}</p>
                        <p className="text-zinc-500 font-bold uppercase tracking-widest text-[9px] mt-1">{attachedFile.size}</p>
                      </div>
                      <button onClick={() => setAttachedFile(null)} className="absolute -top-3 -right-3 p-2 bg-red-500 rounded-full text-white shadow-xl hover:scale-110 transition-all"><X size={14} /></button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Input Bar */}
            <div className="relative group">
              <div className={`absolute inset-0 bg-gradient-to-r ${activeTheme.gradient} blur-[40px] opacity-0 group-focus-within:opacity-20 transition-all duration-700`} />
              <div className="relative flex items-end gap-4 p-4 rounded-[3rem] bg-[#0a0a0a]/80 backdrop-blur-3xl border border-white/10 focus-within:border-white/20 transition-all shadow-[0_30px_60px_rgba(0,0,0,0.8)]">
                <div className="flex gap-2 pl-3 pb-3">
                  <button onClick={() => imageInputRef.current?.click()} className="p-4 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-all group/btn relative">
                    <ImageIcon size={22} />
                    <span className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-zinc-900 text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none border border-white/10">Image</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="p-4 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-all group/btn relative">
                    <Plus size={22} />
                    <span className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-zinc-900 text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none border border-white/10">File</span>
                  </button>
                </div>
                
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Initiate mission parameters..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-zinc-200 placeholder:text-zinc-700 py-5 px-4 resize-none max-h-48 custom-scrollbar text-base lg:text-lg font-medium tracking-tight"
                  rows={1}
                />
                
                <div className="flex gap-2 pr-3 pb-3">
                  <button 
                    onClick={generateImage}
                    disabled={isLoading || !input.trim()}
                    className={`p-4 rounded-full bg-white/5 text-zinc-500 hover:text-${activeTheme.primary} hover:bg-${activeTheme.primary}/10 transition-all disabled:opacity-20 group/btn relative`}
                  >
                    <Wand2 size={22} className={isGeneratingImage ? 'animate-pulse' : ''} />
                    <span className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-zinc-900 text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none border border-white/10 whitespace-nowrap">Generate Image</span>
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={isLoading || (!input.trim() && !selectedImage && !attachedFile)}
                    className={`p-5 rounded-full bg-gradient-to-br ${activeTheme.gradient} text-white shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:scale-110 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100 relative group/send`}
                  >
                    <div className="absolute inset-0 rounded-full bg-white/20 blur-xl opacity-0 group-hover/send:opacity-100 transition-opacity" />
                    <Send size={24} className="relative z-10" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-8 opacity-30">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/20" />
              <p className="text-[9px] text-center text-zinc-500 font-black uppercase tracking-[0.5em] whitespace-nowrap">
                Neural Interface v2.5 • Secured by Nell 56 Developer
              </p>
              <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/20" />
            </div>
          </div>
        </div>
      </main>

      {/* Hidden Inputs */}
      <input type="file" ref={imageInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

      {/* Theme Selector Overlay */}
      <AnimatePresence>
        {showThemeMenu && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowThemeMenu(false)} className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 40 }} 
              className="fixed bottom-32 left-8 lg:left-[360px] p-6 rounded-[3rem] bg-[#0a0a0a]/90 backdrop-blur-3xl border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.8)] z-[90] flex gap-6"
            >
              {(['blue', 'red', 'yellow'] as const).map(t => (
                <button 
                  key={t} 
                  onClick={() => toggleTheme(t)} 
                  className={`w-16 h-16 rounded-[1.5rem] transition-all duration-500 hover:scale-110 relative group ${theme === t ? 'ring-4 ring-white/20 scale-110' : 'opacity-40 grayscale hover:grayscale-0 hover:opacity-100'}`}
                >
                  <div className={`absolute inset-0 rounded-[1.5rem] blur-xl opacity-0 group-hover:opacity-50 transition-opacity ${t === 'blue' ? 'bg-sky-500' : t === 'red' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                  <div className={`w-full h-full rounded-[1.5rem] relative z-10 ${t === 'blue' ? 'bg-sky-500' : t === 'red' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Game System Modals */}
      <AnimatePresence>
        {activeGame && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 bg-black/90 backdrop-blur-2xl z-[200] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 40, opacity: 0 }} 
              animate={{ scale: 1, y: 0, opacity: 1 }} 
              exit={{ scale: 0.8, y: 40, opacity: 0 }}
              transition={{ type: "spring", damping: 20 }}
              className="w-full max-w-2xl"
            >
              {activeGame === 'snake' && <SnakeGame onClose={() => setActiveGame(null)} />}
              {activeGame === 'tictactoe' && <TicTacToeGame onClose={() => setActiveGame(null)} />}
              {activeGame === 'flappy' && <FlappyBirdGame onClose={() => setActiveGame(null)} />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Game Switcher (Mobile Only) */}
      <div className="fixed bottom-36 right-8 lg:hidden flex flex-col gap-4 z-40">
        <motion.button 
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          onClick={() => setActiveGame('snake')} 
          className={`p-5 rounded-full bg-zinc-900/80 backdrop-blur-xl border border-white/10 text-${activeTheme.primary} shadow-2xl shadow-${activeTheme.primary}/20`}
        >
          <Gamepad2 size={28} />
        </motion.button>
      </div>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {scrollRef.current && scrollRef.current.scrollTop > 500 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-36 right-8 hidden lg:flex p-4 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-zinc-500 hover:text-white transition-all z-40"
          >
            <ChevronUp size={24} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
  }
