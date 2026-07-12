"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './page.module.css';
import Link from 'next/link';

export default function RecordMatchPage() {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [events, setEvents] = useState([]);
  const timerRef = useRef(null);
  const [cameraError, setCameraError] = useState("");

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Start Camera
  const startCamera = async () => {
    try {
      // メモリの安定性を最優先し、1080p (Full HD) をリクエスト
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          facingMode: "environment" // 背面カメラ
        },
        audio: true
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setCameraError("カメラへのアクセスに失敗しました。権限を確認してください。");
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      // Cleanup stream on unmount
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleDataAvailable = useCallback((e) => {
    if (e.data.size > 0) {
      setRecordedChunks((prev) => [...prev, e.data]);
    }
  }, []);

  const startRecording = () => {
    const stream = videoRef.current?.srcObject;
    if (!stream) {
      alert("カメラが起動していません。");
      return;
    }

    setRecordedChunks([]);
    setEvents([]);
    setElapsedTime(0);
    
    try {
      // Standard webm
      const options = { mimeType: 'video/webm;codecs=vp8,opus' };
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = handleDataAvailable;
      mediaRecorder.start(2000); // chunk every 2s

      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
      
      handleTagEvent("MATCH_START");
      
    } catch (e) {
      console.error("MediaRecorder error:", e);
      try {
        // Fallback for iOS Safari which might prefer mp4 or generic webm
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = handleDataAvailable;
        mediaRecorder.start(2000);
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
        timerRef.current = setInterval(() => setElapsedTime((prev) => prev + 1), 1000);
        handleTagEvent("MATCH_START");
      } catch (fallbackError) {
        setCameraError("このブラウザは録画機能をサポートしていません。");
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
      handleTagEvent("MATCH_END");
    }
  };

  const handleTagEvent = (tagType) => {
    if (!isRecording && tagType !== "MATCH_START") return;
    const newEvent = {
      timestamp: elapsedTime,
      type: tagType
    };
    setEvents((prev) => [newEvent, ...prev]);
  };

  const downloadData = () => {
    if (recordedChunks.length === 0) {
      alert("録画データがありません。");
      return;
    }

    // 1. Download Video
    const blob = new Blob(recordedChunks, {
      type: recordedChunks[0].type
    });
    const videoUrl = URL.createObjectURL(blob);
    const videoA = document.createElement('a');
    document.body.appendChild(videoA);
    videoA.style = 'display: none';
    videoA.href = videoUrl;
    videoA.download = `futsal_match_${new Date().getTime()}.webm`;
    videoA.click();
    window.URL.revokeObjectURL(videoUrl);

    // 2. Download Event Log
    const eventsJson = JSON.stringify(events, null, 2);
    const eventsBlob = new Blob([eventsJson], { type: 'application/json' });
    const eventsUrl = URL.createObjectURL(eventsBlob);
    const eventsA = document.createElement('a');
    document.body.appendChild(eventsA);
    eventsA.style = 'display: none';
    eventsA.href = eventsUrl;
    eventsA.download = `futsal_events_${new Date().getTime()}.json`;
    eventsA.click();
    window.URL.revokeObjectURL(eventsUrl);
  };

  const EVENT_TAGS = [
    { id: "GOAL", label: "⚽ ゴール", color: "#FFD700" },
    { id: "SAVE", label: "🧤 セーブ", color: "#00CED1" },
    { id: "PASS", label: "👟 パス", color: "#32CD32" },
    { id: "SHOOT", label: "🔥 シュート", color: "#FF4500" },
    { id: "FOUL", label: "⚠️ ファウル", color: "#FF0000" },
    { id: "CUSTOM", label: "🔖 タグ", color: "#8A2BE2" },
  ];

  return (
    <div className={styles.container}>
      <Link href="/admin" style={{ color: '#4facfe', textDecoration: 'none', marginBottom: '20px', display: 'inline-block' }}>
        ← 管理画面に戻る
      </Link>
      <h1 className={styles.title}>MATCH RECORDER</h1>
      {cameraError && <div style={{ color: "red", textAlign: "center", marginBottom: "10px" }}>{cameraError}</div>}
      
      <div className={styles.mainLayout}>
        {/* Left: Video Preview */}
        <div className={styles.videoSection}>
          <div className={styles.videoWrapper}>
            <video
              ref={videoRef}
              className={styles.videoPlayer}
              autoPlay
              muted
              playsInline
            />
          </div>
          <div className={styles.controls}>
            {!isRecording ? (
              <button className={`${styles.btn} ${styles.btnStart}`} onClick={startRecording}>
                ⏺ 録画開始
              </button>
            ) : (
              <button className={`${styles.btn} ${styles.btnStop}`} onClick={stopRecording}>
                ⏹ 録画停止
              </button>
            )}
            
            {!isRecording && recordedChunks.length > 0 && (
              <button className={`${styles.btn} ${styles.btnDownload}`} onClick={downloadData}>
                💾 動画とログを保存
              </button>
            )}
          </div>
        </div>

        {/* Right: Tagging and Log */}
        <div className={styles.taggingSection}>
          <div className={styles.stopwatch}>
            {formatTime(elapsedTime)}
          </div>
          
          <div className={styles.tagGrid}>
            {EVENT_TAGS.map(tag => (
              <button
                key={tag.id}
                className={styles.tagBtn}
                onClick={() => handleTagEvent(tag.id)}
                disabled={!isRecording}
                style={isRecording ? { borderBottom: `4px solid ${tag.color}` } : {}}
              >
                {tag.label}
              </button>
            ))}
          </div>

          <div className={styles.logSection}>
            <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '10px', marginTop: 0 }}>イベントログ</h3>
            {events.map((ev, idx) => (
              <div key={idx} className={styles.logItem}>
                <span className={styles.logTime}>{formatTime(ev.timestamp)}</span>
                <span style={{ fontWeight: 'bold' }}>{ev.type}</span>
              </div>
            ))}
            {events.length === 0 && <div style={{color: '#666', marginTop: '10px'}}>録画を開始してイベントを記録してください。</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
