import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Smartphone, QrCode, Copy, Check, ExternalLink, X, ShieldCheck } from 'lucide-react';

interface PhoneConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PhoneConnectModal: React.FC<PhoneConnectModalProps> = ({ isOpen, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const devUrl = 'https://ais-dev-lyh5qixdjrvjahbqoc256b-696264883591.asia-northeast1.run.app';
  const [currentUrl, setCurrentUrl] = useState<string>(devUrl);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Use origin if valid and not localhost or about:blank, otherwise use devUrl
      const origin = window.location.origin;
      const validOrigin = origin && origin.includes('run.app') ? origin : devUrl;
      setCurrentUrl(validOrigin);

      QRCode.toDataURL(validOrigin, {
        width: 260,
        margin: 2,
        color: {
          dark: '#020617',
          light: '#FFFFFF',
        },
      })
        .then((dataUrl) => {
          setQrDataUrl(dataUrl);
        })
        .catch((err) => {
          console.error('Failed to generate QR code', err);
        });
    }
  }, [isOpen, devUrl]);

  const handleCopy = () => {
    if (!currentUrl) return;
    navigator.clipboard.writeText(currentUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md pointer-events-auto">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">Open on Your Phone</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code and Instructions */}
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          <p className="text-xs text-slate-300">
            Scan this QR code with your phone camera to launch the real-world walking experience immediately:
          </p>

          {/* QR Code Container */}
          <div className="p-3 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-white/20">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Scan to open on phone"
                className="w-52 h-52 object-contain"
              />
            ) : (
              <div className="w-52 h-52 flex items-center justify-center bg-slate-100 rounded-xl">
                <QrCode className="w-8 h-8 text-slate-400 animate-pulse" />
              </div>
            )}
          </div>

          {/* HTTPS Security Badge */}
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Secure HTTPS Enabled (Required for Gyro & WebXR)</span>
          </div>

          {/* URL Box & Copy */}
          <div className="w-full space-y-2">
            <div className="flex items-center gap-2 p-2 bg-slate-950/80 rounded-xl border border-slate-800 text-left">
              <span className="text-[11px] font-mono text-slate-300 truncate flex-1 px-1">
                {currentUrl}
              </span>
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition shrink-0"
                title="Copy URL"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 py-2.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1.5"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Mobile Link'}</span>
              </button>
              <a
                href={currentUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center justify-center"
                title="Open new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer Quick Tips */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/70 text-[11px] text-slate-400 text-left">
          <p>
            💡 <strong>Tip</strong>: On iPhone, open in <strong>Safari</strong> and tap &quot;Enable Sensors&quot; when prompted. On Android, open in <strong>Chrome</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};
