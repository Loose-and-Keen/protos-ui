// src/App.js (Ver 1.0 - API完全分離)

import React, { useState, useEffect } from 'react';
import axios from 'axios'; // 「電話機」
import './App.css'; // デフォルトのCSS

// 「頭脳（FastAPI）」の住所
const API_BASE_URL = "https://protos-api-sgp.onrender.com"; 
// const API_BASE_URL = "http://127.0.0.1:8888"; // ローカルテスト用

// --- MVP用 ユーザーID/名前 (ハードコード) ---
const LOGGED_IN_USER_ID = 'ken';
const LOGGED_IN_USER_NAME = "Ken"; 

function App() {
  // --- 1. Reactの「記憶」 (State) ---
  const [categories, setCategories] = useState([]); 
  const [currentTab, setCurrentTab] = useState('general'); 
  const [presetQuestions, setPresetQuestions] = useState([]); 
  const [chatHistory, setChatHistory] = useState([ 
    { role: "assistant", content: `よっ、${LOGGED_IN_USER_NAME}！何でも聞いてくれよな！👍` }
  ]);
  const [chatInput, setChatInput] = useState(""); 
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState(null); 

  // --- 2. 最初に1回だけ「カテゴリ」を読み込む ---
  useEffect(() => {
    setLoading(true);
    axios.get(`${API_BASE_URL}/api/v1/categories`)
      .then(response => {
        setCategories(response.data.categories);
        setLoading(false);
      })
      .catch(error => {
        setError("「頭脳（API）」との通信に失敗したぜ… Fast APIサーバー（Render）はちゃんと動いてるか？");
        setLoading(false);
      });
  }, []); 

  // --- 3. 「タブ」が切り替わるたびに「プリセット質問」を「API」から読み込む ---
  useEffect(() => {
    if (currentTab === 'general' || !categories.length) {
      setPresetQuestions([]); // 「雑談」タブならボタンは不要
      return;
    }
    
    // ★★★ APIを叩くように修正！ ★★★
    axios.get(`${API_BASE_URL}/api/v1/categories/${currentTab}/questions`)
      .then(response => {
        if (response.data.preset_questions) {
          setPresetQuestions(response.data.preset_questions);
        } else {
          setPresetQuestions([]);
        }
      })
      .catch(error => {
        setError(`「プリセット質問」の読み込みエラー: ${error.message}`);
        setPresetQuestions([]); 
      });
    
  }, [currentTab, categories]); // currentTabが変わるたびに実行

  
  // --- 4. 「型」ボタン（プリセット質問）が押された時の処理 (変更なし) ---
  const handlePresetClick = (question, knowledgeId) => {
    setLoading(true);
    setChatHistory(prev => [...prev, { role: "user", content: question }]);

    axios.get(`${API_BASE_URL}/api/v1/knowledge/${knowledgeId}`, {
      params: { user_id: LOGGED_IN_USER_ID }
    })
      .then(response => {
        const aiResponse = response.data.ai_response || "ごめん、AIがエラー吐いたわ…";
        setChatHistory(prev => [...prev, { role: "assistant", content: aiResponse }]);
        setLoading(false);
      })
      .catch(error => {
        setError(`「頭脳（RAG API）」との通信エラー: ${error.message}`);
        setLoading(false);
      });
  };

  // --- 5. 「雑談」チャットが送信された時の処理 (変更なし) ---
  const handleChatSubmit = (e) => {
    e.preventDefault(); 
    if (!chatInput.trim() || loading) return; 

    setLoading(true);
    const userPrompt = chatInput;
    
    const newUserMessage = { role: "user", content: userPrompt };
    const currentHistory = [...chatHistory, newUserMessage];
    setChatHistory(currentHistory);
    setChatInput(""); 

    // Gemini APIが要求する形式（`parts`がリスト）に履歴を「翻訳」
    const historyForApi = currentHistory.slice(0, -1).map(msg => ({ 
      role: msg.role === "assistant" ? "model" : msg.role, // "assistant"を"model"に翻訳
      parts: [msg.content]
    }));
    
    // 「頭脳（API）」の雑談APIを叩く！
    axios.post(`${API_BASE_URL}/api/v1/chat`, {
      history: historyForApi,
      prompt: userPrompt,
      user_id: LOGGED_IN_USER_ID
    })
      .then(response => {
        const aiResponse = response.data.ai_response || "ごめん、AIがエラー吐いたわ…";
        setChatHistory(prev => [...prev, { role: "assistant", content: aiResponse }]);
        setLoading(false);
      })
      .catch(error => {
        setError(`「頭脳（Chat API）」との通信エラー: ${error.message}`);
        setLoading(false);
      });
  };

  // --- 6. 表示する内容 (JSX) (変更なし) ---
  return (
    <div className="App">
      <header className="App-header">
        <h1>🤖 Ken's スマートライフ (React版)</h1>
        
        <div className="tabs">
          {categories.map(cat => (
            <button 
              key={cat.category_id} 
              onClick={() => setCurrentTab(cat.category_id)}
              className={currentTab === cat.category_id ? 'active' : ''}
            >
              {cat.category_name}
            </button>
          ))}
        </div>

        <div className="preset-questions">
          {presetQuestions.map(pq => (
            <button key={pq.knowledge_id} onClick={() => handlePresetClick(pq.preset_question, pq.knowledge_id)}>
              {pq.preset_question}
            </button>
          ))}
        </div>

        <div className="chat-container">
          {chatHistory.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.role}`}>
              <p><strong>{msg.role === 'assistant' ? 'Ken(AI)' : LOGGED_IN_USER_NAME}:</strong> {msg.content}</p>
            </div>
          ))}
          {loading && <p>Ken(AI)が考え中だぜ...</p>}
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>

        <form onSubmit={handleChatSubmit} className="chat-form">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="なんでも話しかけてみてね"
          />
          <button type="submit" disabled={loading}>送信</button>
        </form>
        
      </header>
    </div>
  );
}

export default App;