import { useState, useEffect, useRef } from 'react';
import { Settings, Mic, CheckCircle2, MessageCircle, Trash2, X } from 'lucide-react';
import { parseVoiceInput } from './voiceParser';

interface Patient {
  id: string;
  serialNumber: number;
  name: string;
  phone: string;
  done: boolean;
  createdAt: number;
  colorClass: string;
}

interface AppSettings {
  day: string;
  date: string;
  time: string;
  geminiKey: string;
}

const defaultSettings: AppSettings = {
  day: 'الخميس',
  date: '',
  time: '5:00 م',
  geminiKey: ''
};

const cardColors = [
  'bg-blue-50', 'bg-green-50', 'bg-yellow-50', 'bg-purple-50', 
  'bg-pink-50', 'bg-orange-50', 'bg-teal-50', 'bg-indigo-50'
];

function App() {
  const [patients, setPatients] = useState<Patient[]>(() => {
    const saved = localStorage.getItem('ortho_patients');
    return saved ? JSON.parse(saved) : [];
  });
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('ortho_settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Voice recognition instance
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem('ortho_patients', JSON.stringify(patients));
  }, [patients]);

  useEffect(() => {
    localStorage.setItem('ortho_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    // Initialize Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'ar-EG';
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsRecording(false);
        setIsProcessing(true);
        
        const { name, phone } = await parseVoiceInput(transcript, settings.geminiKey);
        
        if (name && phone) {
          addPatient(name, phone);
        } else {
          alert('لم يتم التعرف على الاسم والرقم. حاول مرة أخرى.');
        }
        setIsProcessing(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
        setIsProcessing(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsRecording(false);
      }
    } else {
      console.warn("Speech Recognition API not supported in this browser.");
    }
  }, [settings.geminiKey]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("عذراً، متصفحك لا يدعم الإدخال الصوتي.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const addPatient = (name: string, phone: string) => {
    const nextSerial = patients.length > 0 
      ? Math.max(...patients.map(p => p.serialNumber)) + 1 
      : 1;

    const randomColor = cardColors[nextSerial % cardColors.length];

    const newPatient: Patient = {
      id: crypto.randomUUID(),
      serialNumber: nextSerial,
      name,
      phone,
      done: false,
      createdAt: Date.now(),
      colorClass: randomColor
    };

    setPatients(prev => [...prev, newPatient]);
  };

  const markDone = (id: string) => {
    setPatients(prev => 
      prev.map(p => p.id === id ? { ...p, done: !p.done } : p)
    );
  };

  const deletePatient = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المريض نهائياً؟')) {
      setPatients(prev => prev.filter(p => p.id !== id));
    }
  };

  const openWhatsApp = (phone: string) => {
    let cleanPhone = phone.replace(/[^0-9+]/g, '');
    // Ensure country code if missing (optional, adjust based on target region)
    if (cleanPhone.startsWith('0')) {
       // example for Egypt, can be customized or kept generic
       cleanPhone = '+2' + cleanPhone;
    }

    const msg = `موعد الزيارة القادمة مع طبيب التقويم ان شاء الله يوم ${settings.day} تاريخ ${settings.date} الساعة ${settings.time} الرجاء الحضور ف الموعد`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Sort patients: Active first (newest at top), then Done (newest at top)
  const sortedPatients = [...patients].sort((a, b) => {
    if (a.done === b.done) {
      return b.createdAt - a.createdAt; // Newest first
    }
    return a.done ? 1 : -1; // Active first
  });

  return (
    <div className="min-h-screen pb-20 max-w-md mx-auto bg-gray-50 shadow-lg relative">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md sticky top-0 z-10 flex justify-between items-center">
        <h1 className="text-xl font-bold">عيادة التقويم</h1>
        <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-blue-700 rounded-full transition">
          <Settings size={24} />
        </button>
      </header>

      {/* Main List */}
      <main className="p-4 space-y-4">
        {sortedPatients.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            لا يوجد مرضى في القائمة. اضغط على زر الميكروفون للإضافة.
          </div>
        ) : (
          sortedPatients.map((patient) => (
            <div 
              key={patient.id} 
              className={`rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3 transition-all duration-300 relative ${patient.done ? 'opacity-50 grayscale bg-gray-100' : patient.colorClass || 'bg-white'}`}
            >
              <button 
                onClick={() => deletePatient(patient.id)}
                className="absolute top-2 left-2 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition"
                title="حذف المريض"
              >
                <Trash2 size={18} />
              </button>

              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <span className="bg-white text-blue-800 shadow-sm text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center">
                    {patient.serialNumber}
                  </span>
                  <div>
                    <h2 className={`text-lg font-bold text-gray-800 ${patient.done ? 'line-through' : ''}`}>
                      {patient.name}
                    </h2>
                    <p className={`text-gray-600 ${patient.done ? 'line-through' : ''}`} dir="ltr">
                      {patient.phone}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-2">
                <button 
                  onClick={() => openWhatsApp(patient.phone)}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg transition"
                >
                  <MessageCircle size={20} />
                  <span>واتساب</span>
                </button>
                <button 
                  onClick={() => markDone(patient.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition ${patient.done ? 'bg-gray-300 text-gray-700' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'}`}
                >
                  <CheckCircle2 size={20} />
                  <span>{patient.done ? 'تراجع' : 'تم'}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center z-20">
        <button 
          onClick={toggleRecording}
          disabled={isProcessing}
          className={`flex items-center justify-center w-16 h-16 rounded-full shadow-lg transition-transform ${isRecording ? 'bg-red-500 animate-pulse scale-110' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
        >
          {isProcessing ? (
            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Mic size={32} />
          )}
        </button>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
              <h2 className="font-bold text-lg">الإعدادات</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-500 hover:bg-gray-200 p-1 rounded-full">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm mb-2 border border-blue-100">
                💡 <strong>ملاحظة:</strong> اليوم، التاريخ، والساعة التي تقوم بضبطها هنا سيتم إرسالها تلقائياً كرسالة موحدة وثابتة للمواعيد القادمة عند الضغط على زر الواتساب.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اليوم</label>
                <input 
                  type="text" 
                  value={settings.day} 
                  onChange={e => setSettings({...settings, day: e.target.value})}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="مثال: الخميس"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>
                <input 
                  type="text" 
                  value={settings.date} 
                  onChange={e => setSettings({...settings, date: e.target.value})}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="مثال: 15/10/2026"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الساعة</label>
                <input 
                  type="text" 
                  value={settings.time} 
                  onChange={e => setSettings({...settings, time: e.target.value})}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="مثال: 5:00 م"
                />
              </div>
              <div className="pt-2 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  مفتاح Gemini API (لتحسين الصوت)
                </label>
                <input 
                  type="password" 
                  value={settings.geminiKey} 
                  onChange={e => setSettings({...settings, geminiKey: e.target.value})}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-left"
                  dir="ltr"
                  placeholder="AIzaSy..."
                />
                <p className="text-xs text-gray-500 mt-1">اختياري: يجعله يفهم الأسماء والأرقام بشكل أدق.</p>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 transition text-white rounded-lg p-3 font-bold mt-4 shadow-md"
              >
                حفظ وإغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
