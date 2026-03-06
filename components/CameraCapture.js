'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import styles from './CameraCapture.module.css';

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' = back, 'user' = front

  const startCamera = useCallback(async (facing) => {
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    setReady(false);
    setError(null);

    try {
      // Check for Secure Context (HTTPS or localhost)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isNotHttps = window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        
        if (isNotHttps) {
          throw new Error('Kamera hanya bisa diakses melalui koneksi aman (HTTPS). Jika Anda menggunakan IP Address di HP, silakan gunakan HTTPS atau akses melalui Localhost.');
        } else {
          throw new Error('Browser Anda tidak mendukung akses kamera atau fitur ini diblokir.');
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { min: 1280, ideal: 1920 },
          height: { min: 720, ideal: 1080 },
          aspectRatio: { ideal: 1.7777777778 },
          // Request continuous focus if supported
          focusMode: 'continuous',
        },
        audio: false,
      });

      streamRef.current = stream;

      // Try to apply advanced constraints to enable autofocus on track after start
      try {
        const track = stream.getVideoTracks()[0];
        const capabilities = (typeof track.getCapabilities === 'function') ? track.getCapabilities() : {};
        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
          await track.applyConstraints({
            advanced: [{ focusMode: 'continuous' }]
          });
        }
      } catch (e) {
        console.warn('Advanced camera constraints not supported:', e);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setReady(true);
        };
      }
    } catch (err) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser.');
      } else if (err.name === 'NotFoundError') {
        setError('Tidak ada kamera yang terdeteksi pada perangkat ini.');
      } else {
        setError(err.message || 'Gagal membuka kamera. Pastikan browser mendukung dan mengizinkan akses kamera.');
      }
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchCamera = () => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    startCamera(newFacing);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
          // Stop camera
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
          }
          onCapture(file);
        }
      },
      'image/jpeg',
      0.85
    );
  };

  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.container} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h3>Ambil Foto</h3>
          <button className={styles.closeBtn} onClick={handleClose} type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Camera View */}
        <div className={styles.cameraView}>
          {error ? (
            <div className={styles.errorState}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <line x1="9" y1="13" x2="15" y2="13" />
              </svg>
              <p>{error}</p>
              <button className={styles.retryBtn} onClick={() => startCamera(facingMode)} type="button">
                Coba Lagi
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={styles.video}
                style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
              />
              {!ready && (
                <div className={styles.loading}>
                  <div className={styles.spinner} />
                  <p>Membuka kamera...</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        {!error && (
          <div className={styles.controls}>
            {/* Switch camera */}
            <button className={styles.switchBtn} onClick={switchCamera} disabled={!ready} type="button" title="Ganti kamera">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>

            {/* Capture */}
            <button className={styles.captureBtn} onClick={capturePhoto} disabled={!ready} type="button" title="Ambil foto">
              <div className={styles.captureBtnInner} />
            </button>

            {/* Spacer for centering */}
            <div className={styles.switchBtn} style={{ visibility: 'hidden' }} />
          </div>
        )}

        <canvas ref={canvasRef} hidden />
      </div>
    </div>
  );
}
