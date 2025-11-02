// src/App.js (React版 AI-Ken v0.2 - API完全連携)

import React, { useState, useEffect } from 'react';
import axios from 'axios'; // 「電話機」
import './App.css'; // デフォルトのCSS

// 「頭脳（FastAPI）」の住所
const API_BASE_URL = "https://protos-api.onrender.com"; // Kenのuvicornが動いてるポート

// --- MVP用 ユーザーID/名前 (ハードコード) ---
const LOGGED_IN_USER_ID = 'ken';
const LOGGED_IN_USER_NAME = "Ken"; // API側の人格設定（system_prompt）で使われる

function App() {
  // --- 1. Reactの「記憶」 (State) ---
  const [categories, setCategories] = useState([]); // カテゴリタブ用
  const [currentTab, setCurrentTab] = useState('general'); // 今どのタブを選んでるか
  const [presetQuestions, setPresetQuestions] = useState([]); // 「型」の質問ボタン用
  const [chatHistory, setChatHistory] = useState([ // 会話履歴
    { role: "assistant", content: `よっ、${LOGGED_IN_USER_NAME}！何でも聞いてくれよな！👍` }
  ]);
  const [chatInput, setChatInput] = useState(""); // チャット入力欄の文字
  const [loading, setLoading] = useState(false); // AIが考え中かどうか
  const [error, setError] = useState(null); // エラーメッセージ

  // --- 2. 最初に1回だけ「カテゴリ」を読み込む ---
  useEffect(() => {
    setLoading(true);
    axios.get(`${API_BASE_URL}/api/v1/categories`)
      .then(response => {
        setCategories(response.data.categories);
        setLoading(false);
      })
      .catch(error => {
        setError("「頭脳（API）」との通信に失敗したぜ… Fast APIサーバー（uvicorn）はちゃんと動いてるか？");
        setLoading(false);
      });
  }, []); // [] = 最初の一回だけ

  // --- 3. 「タブ」が切り替わるたびに「プリセット質問」を読み込む ---
  useEffect(() => {
    if (currentTab === 'general' || !categories.length) {
      setPresetQuestions([]); // 「雑談」タブならボタンは不要
      return;
    }
    
    // (本当は /api/v1/categories/{category_id}/questions APIが欲しいとこだな！)
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
        setPresetQuestions([]); // エラー時は空にする
      });
    
  }, [currentTab, categories]); // currentTabが変わるたびに実行
  
  // --- 4. 「型」ボタン（プリセット質問）が押された時の処理 ---
  const handlePresetClick = (question, knowledgeId) => {
    setLoading(true);
    // ユーザーが押したボタンを履歴に追加
    setChatHistory(prev => [...prev, { role: "user", content: question }]);

    // 「頭脳（API）」のRAG APIを叩く！
    axios.get(`${API_BASE_URL}/api/v1/knowledge/${knowledgeId}`, {
      params: { user_id: LOGGED_IN_USER_ID }
    })
      .then(response => {
        const aiResponse = response.data.ai_response || "ごめん、AIがエラー吐いたわ…";
        // AIの返事を履歴に追加
        setChatHistory(prev => [...prev, { role: "assistant", content: aiResponse }]);
        setLoading(false);
      })
      .catch(error => {
        setError(`「頭脳（RAG API）」との通信エラー: ${error.message}`);
        setLoading(false);
      });
  };

  // --- 5. 「雑談」チャットが送信された時の処理 ---
  const handleChatSubmit = (e) => {
    e.preventDefault(); // ページの再読み込みを防ぐ
    if (!chatInput.trim() || loading) return; // 空欄かロード中は無視

    setLoading(true);
    const userPrompt = chatInput;
    
    // ユーザーの入力を履歴に追加
    const newUserMessage = { role: "user", content: userPrompt };
    const currentHistory = [...chatHistory, newUserMessage];
    setChatHistory(currentHistory);
    setChatInput(""); // 入力欄を空にする

    // Gemini APIが要求する形式（`parts`がリスト）に履歴を「翻訳」
    const historyForApi = currentHistory.slice(0, -1).map(msg => ({ // 最後の（今送った）メッセージは除く
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
        // AIの返事を履歴に追加
        setChatHistory(prev => [...prev, { role: "assistant", content: aiResponse }]);
        setLoading(false);
      })
      .catch(error => {
        setError(`「頭脳（Chat API）」との通信エラー: ${error.message}`);
        setLoading(false);
      });
  };

  // --- 6. 表示する内容 (JSX) ---
  return (
    <div className="App">
      <header className="App-header">
        <h1>🤖 Ken's スマートライフ (React版)</h1>
        
        {/* --- タブUI --- */}
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

        {/* --- プリセット質問ボタン --- */}
        <div className="preset-questions">
          {presetQuestions.map(pq => (
            <button key={pq.knowledge_id} onClick={() => handlePresetClick(pq.preset_question, pq.knowledge_id)}>
              {pq.preset_question}
            </button>
          ))}
        </div>

        {/* --- チャット履歴 --- */}
        <div className="chat-container">
          {chatHistory.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.role}`}>
              <p><strong>{msg.role === 'assistant' ? 'Ken(AI)' : LOGGED_IN_USER_NAME}:</strong> {msg.content}</p>
            </div>
          ))}
          {loading && <p>Ken(AI)が考え中だぜ...</p>}
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>

        {/* --- チャット入力フォーム --- */}
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