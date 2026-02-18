
import React, { useEffect, useRef } from 'react';
import { User } from '../types';
import { Button } from './Button';

interface LoginPortalProps {
  onLogin: (user: User) => void;
}

export const LoginPortal: React.FC<LoginPortalProps> = ({ onLogin }) => {
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleCredentialResponse = (response: any) => {
      try {
        const base64Url = response.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload);
        
        onLogin({
          id: payload.sub,
          name: payload.name,
          email: payload.email,
          picture: payload.picture
        });
      } catch (e) {
        console.error("Failed to parse Google credential", e);
      }
    };

    const google = (window as any).google;
    if (google && google.accounts) {
      google.accounts.id.initialize({
        client_id: "687157850233-qndl1n3m86v79tje8m4o6e7vj4j0j8j8.apps.googleusercontent.com", 
        callback: handleCredentialResponse,
        auto_select: false,
      });

      if (googleBtnRef.current) {
        google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'pill',
          text: 'signin_with',
          logo_alignment: 'left',
          width: 320
        });
      }
    }
  }, [onLogin]);

  const handleGuestLogin = () => {
    onLogin({
      id: 'user-' + Math.random().toString(36).substr(2, 9),
      name: 'Explorer',
      email: 'user@chatpro.ai',
      picture: `https://ui-avatars.com/api/?name=User&background=3b82f6&color=fff`
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b0d11]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 blur-[100px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 blur-[100px] rounded-full animate-pulse delay-700" />
      </div>
      
      <div className="relative w-full max-w-sm mx-4 bg-[#13151a] border border-gray-800 rounded-[32px] p-10 shadow-2xl text-center">
        <div className="mb-10 inline-flex w-24 h-24 rounded-[30%] bg-blue-600 items-center justify-center shadow-2xl shadow-blue-500/20">
          <span className="text-4xl font-black text-white">CP</span>
        </div>
        
        <h1 className="text-3xl font-black text-white mb-3">Welcome to ChatPro</h1>
        <p className="text-gray-400 mb-10 text-sm font-medium leading-relaxed">
          The fastest AI companion.<br/>
          Click below to start chatting instantly.
        </p>
        
        <div className="space-y-6">
          <Button 
            onClick={handleGuestLogin}
            className="w-full py-4 rounded-2xl text-lg font-bold bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.03]"
          >
            Launch App Now
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-800" />
            <span className="text-[10px] uppercase font-bold text-gray-700 tracking-tighter">Secure Access</span>
            <div className="h-px flex-1 bg-gray-800" />
          </div>

          <div className="flex justify-center opacity-40 hover:opacity-100 transition-opacity">
            <div ref={googleBtnRef} />
          </div>
        </div>

        <div className="mt-12 text-[10px] text-gray-600 font-bold tracking-widest uppercase">
          Powered by Gemini 3.0 Ultra-Fast
        </div>
      </div>
    </div>
  );
};
