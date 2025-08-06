import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, User, Bot, Trash2, Volume2, VolumeX, Settings } from 'lucide-react';

const ModernAIChat = () => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [voiceSettings, setVoiceSettings] = useState({
    rate: 1.1,
    pitch: 1,
    volume: 0.8
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.lang = 'en-US';
      recognitionInstance.interimResults = false;
      recognitionInstance.maxAlternatives = 1;
      recognitionInstance.continuous = false;
      setRecognition(recognitionInstance);
    }

    // Load available voices
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      setAvailableVoices(voices);
      
      // Try to select the best quality voice
      const preferredVoices = [
        // Premium voices (iOS/macOS)
        voices.find(v => v.name.includes('Samantha')),
        voices.find(v => v.name.includes('Alex')),
        voices.find(v => v.name.includes('Karen')),
        voices.find(v => v.name.includes('Moira')),
        voices.find(v => v.name.includes('Tessa')),
        
        // Google Chrome premium voices
        voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')),
        
        // Microsoft Edge voices
        voices.find(v => v.name.includes('Microsoft') && v.name.includes('Aria')),
        voices.find(v => v.name.includes('Microsoft') && v.name.includes('Jenny')),
        voices.find(v => v.name.includes('Microsoft') && v.name.includes('Guy')),
        
        // Neural voices
        voices.find(v => v.name.toLowerCase().includes('neural')),
        
        // High quality system voices
        voices.find(v => v.lang.startsWith('en') && v.localService && v.name.includes('Premium')),
        voices.find(v => v.lang.startsWith('en') && v.localService),
        
        // Fallback to any English voice
        voices.find(v => v.lang.startsWith('en'))
      ].filter(Boolean);
      
      if (preferredVoices.length > 0) {
        setSelectedVoice(preferredVoices[0]);
      }
    };

    // Load voices immediately and also listen for voice changes
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
    
    return () => {
      speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    // Scroll to bottom when new messages are added
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (text, isUser = true) => {
    const newMessage = {
      id: Date.now(),
      text,
      isUser,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    // Add user message
    addMessage(text, true);
    setInputText('');
    setIsLoading(true);

    try {
      // Simulate AI response (replace with your backend call)
      const response = await fetch('http://localhost:8000/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      addMessage(data.answer, false);
      speakOut(data.answer);
    } catch (error) {
      console.error('Error contacting backend:', error);
      // Fallback response for demo
      const fallbackResponse = "I'm having trouble connecting to the backend. This is a demo response. Your message was: " + text;
      addMessage(fallbackResponse, false);
      speakOut(fallbackResponse);
    } finally {
      setIsLoading(false);
    }
  };

  const speakOut = (text) => {
    if (!('speechSynthesis' in window)) return;
    
    // Stop any current speech
    speechSynthesis.cancel();
    
    // Split long text into smaller chunks for better pronunciation
    const chunks = text.match(/[^\.!?]+[\.!?]+/g) || [text];
    
    const speakChunk = (chunkIndex = 0) => {
      if (chunkIndex >= chunks.length) {
        setIsSpeaking(false);
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex].trim());
      
      // Use selected voice or fallback
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      
      // Apply voice settings
      utterance.rate = voiceSettings.rate;
      utterance.pitch = voiceSettings.pitch;
      utterance.volume = voiceSettings.volume;
      
      // Set language for better pronunciation
      utterance.lang = selectedVoice?.lang || 'en-US';
      
      setIsSpeaking(true);
      
      utterance.onend = () => {
        // Continue with next chunk after a brief pause
        setTimeout(() => speakChunk(chunkIndex + 1), 100);
      };
      
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error);
        setIsSpeaking(false);
      };
      
      speechSynthesis.speak(utterance);
    };
    
    speakChunk();
  };

  const stopSpeaking = () => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const startListening = () => {
    if (!recognition) {
      alert('Speech recognition not supported in this browser');
      return;
    }

    setIsListening(true);

    recognition.onresult = (event) => {
      const speechText = event.results[0][0].transcript;
      setInputText(speechText);
      setIsListening(false);
      // Auto-send the voice message
      setTimeout(() => sendMessage(speechText), 100);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
    }
    setIsListening(false);
  };

  const handleSubmit = () => {
    sendMessage(inputText);
  };

  const clearChat = () => {
    setMessages([]);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>

      {/* Voice Settings Panel */}
      {showVoiceSettings && (
        <div className="bg-white border-b border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Voice Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Voice</label>
              <select
                value={selectedVoice?.name || ''}
                onChange={(e) => {
                  const voice = availableVoices.find(v => v.name === e.target.value);
                  setSelectedVoice(voice);
                }}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {availableVoices
                  .filter(voice => voice.lang.startsWith('en'))
                  .sort((a, b) => {
                    // Prioritize premium/neural voices
                    const aPremium = a.name.toLowerCase().includes('premium') || 
                                    a.name.toLowerCase().includes('neural') ||
                                    a.name.includes('Microsoft') ||
                                    a.name.includes('Google') ||
                                    a.localService;
                    const bPremium = b.name.toLowerCase().includes('premium') || 
                                    b.name.toLowerCase().includes('neural') ||
                                    b.name.includes('Microsoft') ||
                                    b.name.includes('Google') ||
                                    b.localService;
                    
                    if (aPremium && !bPremium) return -1;
                    if (!aPremium && bPremium) return 1;
                    return a.name.localeCompare(b.name);
                  })
                  .map(voice => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} {voice.localService ? '(Local)' : '(Remote)'}
                    </option>
                  ))
                }
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Speed</label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={voiceSettings.rate}
                  onChange={(e) => setVoiceSettings(prev => ({...prev, rate: parseFloat(e.target.value)}))}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-gray-500">{voiceSettings.rate}x</span>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Pitch</label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={voiceSettings.pitch}
                  onChange={(e) => setVoiceSettings(prev => ({...prev, pitch: parseFloat(e.target.value)}))}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-gray-500">{voiceSettings.pitch}</span>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Volume</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={voiceSettings.volume}
                  onChange={(e) => setVoiceSettings(prev => ({...prev, volume: parseFloat(e.target.value)}))}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-gray-500">{Math.round(voiceSettings.volume * 100)}%</span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-between items-center">
            <button
              onClick={() => speakOut("Hello! This is how I sound with the current settings.")}
              className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md transition-colors"
            >
              Test Voice
            </button>
            <button
              onClick={() => setShowVoiceSettings(false)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
            <div>
              <h1 className="text-xl font-semibold text-gray-800">AI Assistant</h1>
              <p className="text-sm text-gray-500">Voice & Text Chat</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={isSpeaking ? stopSpeaking : () => setShowVoiceSettings(!showVoiceSettings)}
              className={`p-2 rounded-lg transition-colors ${
                isSpeaking 
                  ? 'text-red-500 hover:bg-red-50' 
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
              title={isSpeaking ? 'Stop speaking' : 'Voice settings'}
            >
              {isSpeaking ? <VolumeX className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
            </button>
            <button
              onClick={clearChat}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Clear chat"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            <Bot className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">Welcome to AI Assistant</h3>
            <p>Start a conversation by typing a message or using voice input</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[80%] ${message.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.isUser ? 'bg-blue-500 ml-3' : 'bg-gray-400 mr-3'
              }`}>
                {message.isUser ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-white" />
                )}
              </div>
              <div className={`rounded-2xl px-4 py-2 ${
                message.isUser 
                  ? 'bg-blue-500 text-white rounded-br-md' 
                  : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-200'
              }`}>
                <p className="text-sm leading-relaxed">{message.text}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className={`text-xs ${
                    message.isUser ? 'text-blue-100' : 'text-gray-400'
                  }`}>
                    {message.timestamp}
                  </p>
                  {!message.isUser && (
                    <button
                      onClick={() => speakOut(message.text)}
                      disabled={isSpeaking}
                      className={`ml-2 p-1 rounded hover:bg-gray-100 transition-colors ${
                        isSpeaking ? 'opacity-50 cursor-not-allowed' : 'opacity-60 hover:opacity-100'
                      }`}
                      title="Read aloud"
                    >
                      <Volume2 className="w-3 h-3 text-gray-500" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex">
              <div className="w-8 h-8 rounded-full bg-gray-400 mr-3 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-200">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-end space-x-2">
          <div className="flex-1 min-w-0">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message or use voice input..."
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none max-h-32"
              rows="1"
              disabled={isLoading}
            />
          </div>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading}
              className={`p-3 rounded-full transition-colors ${
                isListening 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isListening ? 'Stop listening' : 'Start voice input'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={!inputText.trim() || isLoading}
              className="p-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-full transition-colors"
              title="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {isListening && (
          <div className="mt-2 text-center">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-100 text-red-800 text-sm">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
              Listening...
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModernAIChat;