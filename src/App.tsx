import { useState, useEffect, useRef } from 'react';
import { Settings, Mic, CheckCircle2, MessageCircle, Trash2, X, Plus, Phone } from 'lucide-react';
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
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [isAddManualOpen, setIsAddManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  
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

  const confirmDelete = () => {
    if (deleteConfirmId) {
      setPatients(prev => prev.filter(p => p.id !== deleteConfirmId));
      setDeleteConfirmId(null);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualName.trim() && manualPhone.trim()) {
      addPatient(manualName.trim(), manualPhone.trim());
      setIsAddManualOpen(false);
      setManualName('');
      setManualPhone('');
    }
  };

  const openWhatsApp = (phone: string) => {
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    
    // Convert to international format for Egypt without 00 or + 
    // Example: 01012345678 -> 201012345678
    if (cleanPhone.startsWith('002')) {
       cleanPhone = cleanPhone.substring(3);
       cleanPhone = '20' + cleanPhone;
    } else if (cleanPhone.startsWith('0')) {
       cleanPhone = '2' + cleanPhone;
    } else if (!cleanPhone.startsWith('20')) {
       cleanPhone = '20' + cleanPhone;
    }

    const msg = `موعد الزيارة القادمة مع طبيب التقويم ان شاء الله يوم ${settings.day} تاريخ ${settings.date} الساعة ${settings.time} الرجاء الحضور ف الموعد`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const exportToCSV = () => {
    if (patients.length === 0) {
      alert("لا يوجد مرضى للتصدير.");
      return;
    }
    
    // BOM for Excel Arabic support
    const BOM = "\uFEFF";
    let csvContent = BOM + "المسلسل,الاسم,رقم الهاتف,الحالة\n";
    
    patients.forEach(p => {
      const status = p.done ? "تم" : "نشط";
      // Escape quotes and commas
      const name = `"${p.name.replace(/"/g, '""')}"`;
      const phone = `"${p.phone}"`;
      csvContent += `${p.serialNumber},${name},${phone},${status}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `مرضى_التقويم_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        <div className="flex gap-2">
          <button onClick={() => setIsAddManualOpen(true)} className="p-2 hover:bg-blue-700 rounded-full transition">
            <Plus size={24} />
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-blue-700 rounded-full transition">
            <Settings size={24} />
          </button>
        </div>
      </header>

      {/* Main List */}
      <main className="p-4 space-y-4">
        {sortedPatients.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            لا يوجد مرضى في القائمة. اضغط على الميكروفون أو زر الإضافة (+) لإدخال مريض.
          </div>
        ) : (
          sortedPatients.map((patient) => (
            <div 
              key={patient.id} 
              className={`rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3 transition-all duration-300 ${patient.done ? 'opacity-50 grayscale bg-gray-100' : patient.colorClass || 'bg-white'}`}
            >
              <div className="flex justify-between items-start">
                <span className="text-red-600 font-bold text-sm bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                  {patient.serialNumber}
                </span>
                <button 
                  onClick={() => setDeleteConfirmId(patient.id)}
                  className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-full transition -mt-1 -ml-1"
                  title="حذف المريض"
                >
                  <Trash2 size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <h2 className={`text-xl font-bold text-gray-800 ${patient.done ? 'line-through' : ''}`}>
                  {patient.name}
                </h2>
                <p className={`text-gray-600 ${patient.done ? 'line-through' : ''} text-right w-full text-lg`}>
                  <span dir="ltr">{patient.phone}</span>
                </p>
              </div>
              
              <div className="flex gap-3 mt-2 items-center">
                <a 
                  href={`tel:${patient.phone}`}
                  className="w-10 h-10 flex flex-shrink-0 items-center justify-center bg-indigo-500 hover:bg-indigo-600 text-white rounded-full transition shadow-sm"
                  title="اتصال"
                >
                  <Phone size={18} />
                </a>
                <button 
                  onClick={() => openWhatsApp(patient.phone)}
                  className="w-10 h-10 flex flex-shrink-0 items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded-full transition shadow-sm"
                  title="واتساب"
                >
                  <MessageCircle size={18} />
                </button>
                <button 
                  onClick={() => markDone(patient.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition text-sm font-bold shadow-sm h-10 ${patient.done ? 'bg-gray-300 text-gray-700' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                >
                  <CheckCircle2 size={18} />
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
              <div className="flex gap-2 mt-4">
                <button 
                  onClick={exportToCSV}
                  className="flex-1 bg-green-600 hover:bg-green-700 transition text-white rounded-lg p-3 font-bold shadow-md"
                >
                  تصدير لـ Excel
                </button>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 transition text-white rounded-lg p-3 font-bold shadow-md"
                >
                  حفظ وإغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Modal */}
      {isAddManualOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-30 flex items-center justify-center p-4">
          <form onSubmit={handleManualSubmit} className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
              <h2 className="font-bold text-lg">إضافة مريض يدوياً</h2>
              <button type="button" onClick={() => setIsAddManualOpen(false)} className="text-gray-500 hover:bg-gray-200 p-1 rounded-full">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المريض</label>
                <input 
                  type="text" 
                  required
                  value={manualName} 
                  onChange={e => setManualName(e.target.value)}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="محمد أحمد..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
                <input 
                  type="tel" 
                  required
                  value={manualPhone} 
                  onChange={e => setManualPhone(e.target.value)}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none text-left"
                  dir="ltr"
                  placeholder="010..."
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 transition text-white rounded-lg p-3 font-bold mt-4 shadow-md"
              >
                إضافة المريض
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <Trash2 size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-800">تأكيد الحذف</h2>
              <p className="text-gray-600 text-sm">
                هل أنت متأكد من حذف هذا المريض نهائياً؟ لا يمكن التراجع عن هذه الخطوة.
              </p>
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl p-3 font-bold transition"
                >
                  إلغاء
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl p-3 font-bold transition shadow-md"
                >
                  حذف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
