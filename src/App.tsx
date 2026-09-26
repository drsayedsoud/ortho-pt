import { useState, useEffect, useRef } from 'react';
import {
  Settings, Mic, CheckCircle2, MessageCircle, Trash2, X, Plus,
  Phone, Clock, ListTodo, KeyRound, Save, TestTube2, Pencil,
  Stethoscope, Users
} from 'lucide-react';
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

// Modal for API key actions confirmation
type KeyModalType = 'edit' | 'save' | 'test' | null;

function App() {
  const [activeTab, setActiveTab] = useState<'main' | 'waiting'>('main');
  const activeTabRef = useRef(activeTab);

  const [patients, setPatients] = useState<Patient[]>(() => {
    const saved = localStorage.getItem('ortho_patients');
    return saved ? JSON.parse(saved) : [];
  });

  const [waitingPatients, setWaitingPatients] = useState<Patient[]>(() => {
    const saved = localStorage.getItem('ortho_waiting');
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

  // API Key states
  const [keyModalType, setKeyModalType] = useState<KeyModalType>(null);
  const [keyEditable, setKeyEditable] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { localStorage.setItem('ortho_patients', JSON.stringify(patients)); }, [patients]);
  useEffect(() => { localStorage.setItem('ortho_waiting', JSON.stringify(waitingPatients)); }, [waitingPatients]);
  useEffect(() => { localStorage.setItem('ortho_settings', JSON.stringify(settings)); }, [settings]);

  useEffect(() => {
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

      recognitionRef.current.onend = () => { setIsRecording(false); };
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
    const isWaitingTab = activeTabRef.current === 'waiting';
    const setList = isWaitingTab ? setWaitingPatients : setPatients;
    setList(prev => {
      const nextSerial = prev.length > 0 ? Math.max(...prev.map(p => p.serialNumber)) + 1 : 1;
      const randomColor = cardColors[nextSerial % cardColors.length];
      return [...prev, { id: crypto.randomUUID(), serialNumber: nextSerial, name, phone, done: false, createdAt: Date.now(), colorClass: randomColor }];
    });
  };

  const markDone = (id: string) => {
    if (activeTab === 'waiting') return;
    setPatients(prev => prev.map(p => p.id === id ? { ...p, done: !p.done } : p));
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      if (activeTab === 'waiting') {
        setWaitingPatients(prev => prev.filter(p => p.id !== deleteConfirmId));
      } else {
        setPatients(prev => prev.filter(p => p.id !== deleteConfirmId));
      }
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
    if (cleanPhone.startsWith('002')) { cleanPhone = '20' + cleanPhone.substring(3); }
    else if (cleanPhone.startsWith('0')) { cleanPhone = '2' + cleanPhone; }
    else if (!cleanPhone.startsWith('20')) { cleanPhone = '20' + cleanPhone; }
    const msg = `موعد الزيارة القادمة مع طبيب التقويم ان شاء الله يوم ${settings.day} تاريخ ${settings.date} الساعة ${settings.time} الرجاء الحضور ف الموعد`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const exportToCSV = () => {
    const listToExport = activeTab === 'waiting' ? waitingPatients : patients;
    if (listToExport.length === 0) { alert("لا يوجد مرضى للتصدير."); return; }
    const BOM = "\uFEFF";
    let csvContent = BOM + "المسلسل,الاسم,رقم الهاتف,الحالة\n";
    listToExport.forEach(p => {
      csvContent += `${p.serialNumber},"${p.name.replace(/"/g, '""')}","${p.phone}",${p.done ? "تم" : "نشط"}\n`;
    });
    const url = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement("a");
    link.href = url;
    link.download = activeTab === 'waiting'
      ? `حالات_الانتظار_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.csv`
      : `مرضى_التقويم_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- API Key Handlers ---
  const handleEditKey = () => {
    setTempKey(settings.geminiKey);
    setKeyEditable(true);
    setKeyModalType(null);
  };

  const handleSaveKey = () => {
    setSettings({ ...settings, geminiKey: tempKey });
    setKeyEditable(false);
    setKeyModalType(null);
  };

  const handleTestKey = async () => {
    setIsTesting(true);
    setTestResult(null);
    const keyToTest = keyEditable ? tempKey : settings.geminiKey;
    if (!keyToTest.trim()) {
      setIsTesting(false);
      setTestResult({ success: false, message: 'لم يتم إدخال أي مفتاح بعد!' });
      return;
    }
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${keyToTest}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] }),
        }
      );
      if (res.ok) {
        setTestResult({ success: true, message: '✅ المفتاح يعمل بشكل ممتاز!' });
      } else {
        const err = await res.json();
        setTestResult({ success: false, message: `❌ المفتاح غير صالح: ${err?.error?.message || 'خطأ غير معروف'}` });
      }
    } catch {
      setTestResult({ success: false, message: '❌ فشل الاتصال. تحقق من الإنترنت.' });
    }
    setIsTesting(false);
  };

  const currentList = activeTab === 'waiting' ? waitingPatients : patients;
  const sortedPatients = [...currentList].sort((a, b) => {
    if (a.done === b.done) return b.createdAt - a.createdAt;
    return a.done ? 1 : -1;
  });

  const isWaiting = activeTab === 'waiting';
  const totalPatients = patients.length;
  const donePatients = patients.filter(p => p.done).length;
  const activePatients = totalPatients - donePatients;

  return (
    <div className={`min-h-screen pb-24 max-w-md mx-auto shadow-2xl relative transition-colors duration-300 ${isWaiting ? 'bg-amber-50' : 'bg-slate-50'}`}>

      {/* ===== PROFESSIONAL HEADER ===== */}
      <header className={`sticky top-0 z-10 transition-all duration-300 ${isWaiting
        ? 'bg-gradient-to-l from-amber-700 to-orange-500'
        : 'bg-gradient-to-l from-blue-800 to-blue-500'
      } shadow-lg`}>

        {/* Row 1: Title */}
        <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/20 shadow flex-shrink-0">
            {isWaiting
              ? <Clock size={20} className="text-white" />
              : <Stethoscope size={20} className="text-white" />
            }
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white leading-tight tracking-wide">
              {isWaiting ? 'حالات الانتظار' : 'عيادة التقويم'}
            </h1>
            <p className="text-[10px] text-white/70 leading-none">
              {isWaiting ? 'قائمة المراجعين المنتظرين' : 'إدارة مرضى التقويم'}
            </p>
          </div>
        </div>

        {/* Row 2: Action Buttons */}
        <div className="flex items-center gap-2 px-4 pb-2">
          {/* Switch Tab button */}
          {isWaiting ? (
            <button
              onClick={() => setActiveTab('main')}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition shadow-md"
            >
              <ListTodo size={14} />
              العيادة
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('waiting')}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition shadow-md"
            >
              <Clock size={14} />
              الانتظار
            </button>
          )}

          {/* Add button */}
          <button
            onClick={() => setIsAddManualOpen(true)}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-2 rounded-xl transition"
            title="إضافة يدوية"
          >
            <Plus size={15} />
            إضافة
          </button>

          {/* Settings button (main only) */}
          {!isWaiting && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-2 rounded-xl transition"
            title="الإعدادات"
          >
            <Settings size={15} className="text-white" />
            الإعدادات
          </button>
          )}
        </div>

        {/* Stats bar */}
        <div className="px-4 pb-3">
          {isWaiting ? (
            <div className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2">
              <Users size={14} className="text-white/80" />
              <span className="text-white text-xs font-semibold">إجمالي الانتظار:</span>
              <span className="text-white font-extrabold text-sm">{waitingPatients.length}</span>
              <span className="text-white/50 text-xs mr-auto">حالة</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/15 rounded-xl px-2 py-1.5 text-center">
                <p className="text-white/70 text-[9px] font-medium">الإجمالي</p>
                <p className="text-white font-extrabold text-base leading-tight">{totalPatients}</p>
              </div>
              <div className="bg-white/15 rounded-xl px-2 py-1.5 text-center">
                <p className="text-white/70 text-[9px] font-medium">نشط</p>
                <p className="text-white font-extrabold text-base leading-tight">{activePatients}</p>
              </div>
              <div className="bg-white/15 rounded-xl px-2 py-1.5 text-center">
                <p className="text-white/70 text-[9px] font-medium">منتهي</p>
                <p className="text-white font-extrabold text-base leading-tight">{donePatients}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ===== MAIN LIST ===== */}
      <main className="p-4 space-y-4">
        {sortedPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-16 gap-3 text-gray-400">
            {isWaiting
              ? <Clock size={48} className="text-amber-300" />
              : <Stethoscope size={48} className="text-blue-200" />
            }
            <p className="text-center text-sm px-6">
              {isWaiting
                ? 'لا يوجد حالات انتظار. اضغط على الميكروفون أو زر الإضافة لإدخال حالة.'
                : 'لا يوجد مرضى في القائمة. اضغط على الميكروفون أو زر الإضافة (+) لإدخال مريض.'}
            </p>
          </div>
        ) : (
          sortedPatients.map((patient) => (
            <div
              key={patient.id}
              className={`rounded-2xl shadow-sm border flex flex-col gap-3 transition-all duration-300 overflow-hidden ${
                isWaiting
                  ? 'bg-white border-amber-200'
                  : (patient.done ? 'opacity-50 grayscale bg-gray-100 border-gray-200' : `${patient.colorClass || 'bg-white'} border-gray-100`)
              }`}
            >
              {/* Card top accent bar */}
              <div className={`h-1 w-full ${isWaiting ? 'bg-gradient-to-r from-amber-500 to-orange-400' : (patient.done ? 'bg-gray-300' : 'bg-gradient-to-r from-blue-500 to-indigo-400')}`} />

              <div className="px-4 pb-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <span className={`font-extrabold text-sm px-2.5 py-1 rounded-lg border ${
                    isWaiting ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-blue-700 bg-blue-50 border-blue-200'
                  }`}>
                    # {patient.serialNumber}
                  </span>
                  <button
                    onClick={() => setDeleteConfirmId(patient.id)}
                    className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition"
                    title="حذف"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div>
                  <h2 className={`text-xl font-bold text-gray-800 ${!isWaiting && patient.done ? 'line-through text-gray-400' : ''}`}>
                    {patient.name}
                  </h2>
                  <p className={`text-gray-500 text-base mt-0.5 ${!isWaiting && patient.done ? 'line-through' : ''}`}>
                    <span dir="ltr">{patient.phone}</span>
                  </p>
                </div>

                <div className="flex gap-2 items-center">
                  <a
                    href={`tel:${patient.phone}`}
                    className={`w-10 h-10 flex flex-shrink-0 items-center justify-center text-white rounded-full transition shadow-sm ${
                      isWaiting ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-500 hover:bg-indigo-600'
                    }`}
                    title="اتصال"
                  >
                    <Phone size={17} />
                  </a>
                  <button
                    onClick={() => openWhatsApp(patient.phone)}
                    className="w-10 h-10 flex flex-shrink-0 items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded-full transition shadow-sm"
                    title="واتساب"
                  >
                    <MessageCircle size={17} />
                  </button>

                  {isWaiting ? (
                    <button
                      onClick={() => setWaitingPatients(prev => prev.filter(p => p.id !== patient.id))}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition text-sm font-bold h-10"
                    >
                      <CheckCircle2 size={16} />
                      تم التواصل — حذف الآن
                    </button>
                  ) : (
                    <button
                      onClick={() => markDone(patient.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition text-sm font-bold shadow-sm h-10 ${
                        patient.done ? 'bg-gray-200 text-gray-600 hover:bg-gray-300' : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      <CheckCircle2 size={17} />
                      {patient.done ? 'تراجع' : 'تم'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </main>

      {/* ===== FLOATING MIC BUTTON ===== */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center z-20">
        <button
          onClick={toggleRecording}
          disabled={isProcessing}
          className={`flex items-center justify-center w-16 h-16 rounded-full shadow-xl transition-all duration-200 text-white ${
            isRecording
              ? 'bg-red-500 animate-pulse scale-110 shadow-red-300'
              : (isWaiting ? 'bg-amber-600 hover:bg-amber-700 hover:scale-105' : 'bg-blue-600 hover:bg-blue-700 hover:scale-105')
          }`}
        >
          {isProcessing
            ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
            : <Mic size={30} />
          }
        </button>
      </div>

      {/* ===== SETTINGS MODAL ===== */}
      {isSettingsOpen && !isWaiting && (
        <div className="fixed inset-0 bg-black/60 z-30 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-l from-blue-800 to-blue-600 px-5 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Settings size={20} className="text-white" />
                <h2 className="font-bold text-lg text-white">الإعدادات</h2>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="text-white/70 hover:text-white hover:bg-white/20 p-1.5 rounded-full transition">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* WhatsApp Info */}
              <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-sm border border-blue-100">
                💡 <strong>ملاحظة:</strong> اليوم، التاريخ، والساعة تُستخدم في رسالة الواتساب التلقائية.
              </div>

              {/* Day */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">📅 اليوم</label>
                <input
                  type="text"
                  value={settings.day}
                  onChange={e => setSettings({ ...settings, day: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-400 outline-none bg-gray-50 text-sm"
                  placeholder="مثال: الخميس"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">🗓️ التاريخ</label>
                <input
                  type="text"
                  value={settings.date}
                  onChange={e => setSettings({ ...settings, date: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-400 outline-none bg-gray-50 text-sm"
                  placeholder="مثال: 15/10/2026"
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">⏰ الساعة</label>
                <input
                  type="text"
                  value={settings.time}
                  onChange={e => setSettings({ ...settings, time: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-400 outline-none bg-gray-50 text-sm"
                  placeholder="مثال: 5:00 م"
                />
              </div>

              {/* ===== GEMINI API KEY SECTION ===== */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 flex items-center gap-2 border-b border-gray-200">
                  <KeyRound size={16} className="text-purple-600" />
                  <span className="text-sm font-bold text-gray-700">مفتاح Gemini API</span>
                  {settings.geminiKey && !keyEditable && (
                    <span className="mr-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">محفوظ ✓</span>
                  )}
                </div>

                <div className="p-4 space-y-3">
                  {/* Key input */}
                  <input
                    type={keyEditable ? 'text' : 'password'}
                    value={keyEditable ? tempKey : settings.geminiKey}
                    onChange={e => keyEditable && setTempKey(e.target.value)}
                    readOnly={!keyEditable}
                    className={`w-full border rounded-xl p-2.5 text-left text-sm outline-none transition ${
                      keyEditable
                        ? 'border-purple-400 focus:ring-2 focus:ring-purple-300 bg-white'
                        : 'border-gray-200 bg-gray-50 text-gray-500 cursor-default'
                    }`}
                    dir="ltr"
                    placeholder="AIzaSy..."
                  />
                  <p className="text-xs text-gray-400">اختياري — يُحسّن دقة التعرف على الأسماء والأرقام.</p>

                  {/* Test result banner */}
                  {testResult && (
                    <div className={`text-sm px-3 py-2 rounded-xl font-medium ${testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {testResult.message}
                    </div>
                  )}

                  {/* 3 Action Buttons */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {/* Edit */}
                    <button
                      onClick={() => setKeyModalType('edit')}
                      className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 transition text-xs font-bold"
                    >
                      <Pencil size={16} />
                      تعديل
                    </button>

                    {/* Save */}
                    <button
                      onClick={() => setKeyModalType('save')}
                      disabled={!keyEditable}
                      className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border transition text-xs font-bold ${
                        keyEditable
                          ? 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700'
                          : 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      <Save size={16} />
                      حفظ
                    </button>

                    {/* Test */}
                    <button
                      onClick={() => setKeyModalType('test')}
                      disabled={isTesting}
                      className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 transition text-xs font-bold"
                    >
                      {isTesting
                        ? <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                        : <TestTube2 size={16} />
                      }
                      اختبار
                    </button>
                  </div>
                </div>
              </div>

              {/* Export & Close */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={exportToCSV}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 transition text-white rounded-xl p-3 font-bold shadow-sm text-sm"
                >
                  تصدير Excel
                </button>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 transition text-white rounded-xl p-3 font-bold shadow-sm text-sm"
                >
                  حفظ وإغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== API KEY CONFIRMATION MODALS ===== */}
      {keyModalType && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden">
            {/* Edit confirmation */}
            {keyModalType === 'edit' && (
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                  <Pencil size={26} />
                </div>
                <h3 className="text-lg font-bold text-gray-800">تعديل المفتاح</h3>
                <p className="text-gray-500 text-sm">هل تريد فتح حقل المفتاح للتعديل؟ ستحتاج إلى الضغط على "حفظ" بعد التعديل.</p>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setKeyModalType(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl p-2.5 font-bold text-sm transition">إلغاء</button>
                  <button onClick={handleEditKey} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl p-2.5 font-bold text-sm transition">تعديل</button>
                </div>
              </div>
            )}

            {/* Save confirmation */}
            {keyModalType === 'save' && (
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                  <Save size={26} />
                </div>
                <h3 className="text-lg font-bold text-gray-800">حفظ المفتاح</h3>
                <p className="text-gray-500 text-sm">هل تريد حفظ المفتاح الجديد؟ سيتم استخدامه فوراً في جميع عمليات التعرف الصوتي.</p>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setKeyModalType(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl p-2.5 font-bold text-sm transition">إلغاء</button>
                  <button onClick={handleSaveKey} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-2.5 font-bold text-sm transition">حفظ</button>
                </div>
              </div>
            )}

            {/* Test confirmation */}
            {keyModalType === 'test' && (
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <TestTube2 size={26} />
                </div>
                <h3 className="text-lg font-bold text-gray-800">اختبار المفتاح</h3>
                <p className="text-gray-500 text-sm">سيتم إرسال طلب تجريبي إلى Gemini API للتحقق من صلاحية المفتاح الحالي. هل تريد الاستمرار؟</p>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setKeyModalType(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl p-2.5 font-bold text-sm transition">إلغاء</button>
                  <button
                    onClick={() => { setKeyModalType(null); handleTestKey(); }}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl p-2.5 font-bold text-sm transition"
                  >
                    اختبار
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== MANUAL ADD MODAL ===== */}
      {isAddManualOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 flex items-end sm:items-center justify-center p-4">
          <form onSubmit={handleManualSubmit} className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className={`px-5 py-4 flex justify-between items-center ${isWaiting ? 'bg-gradient-to-l from-amber-700 to-orange-500' : 'bg-gradient-to-l from-blue-800 to-blue-600'}`}>
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-white" />
                <h2 className="font-bold text-base text-white">
                  {isWaiting ? 'إضافة حالة انتظار' : 'إضافة مريض يدوياً'}
                </h2>
              </div>
              <button type="button" onClick={() => setIsAddManualOpen(false)} className="text-white/70 hover:text-white hover:bg-white/20 p-1.5 rounded-full transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">اسم المريض</label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  className={`w-full border rounded-xl p-2.5 focus:ring-2 outline-none text-sm ${isWaiting ? 'focus:ring-amber-400 border-amber-200' : 'focus:ring-blue-400 border-gray-200'}`}
                  placeholder="محمد أحمد..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">رقم الهاتف</label>
                <input
                  type="tel"
                  required
                  value={manualPhone}
                  onChange={e => setManualPhone(e.target.value)}
                  className={`w-full border rounded-xl p-2.5 focus:ring-2 outline-none text-left text-sm ${isWaiting ? 'focus:ring-amber-400 border-amber-200' : 'focus:ring-blue-400 border-gray-200'}`}
                  dir="ltr"
                  placeholder="010..."
                />
              </div>
              <button
                type="submit"
                className={`w-full transition text-white rounded-xl p-3 font-bold shadow-md text-sm ${isWaiting ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                إضافة
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===== DELETE CONFIRMATION MODAL ===== */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={28} />
              </div>
              <h2 className="text-lg font-bold text-gray-800">تأكيد الحذف</h2>
              <p className="text-gray-500 text-sm">هل أنت متأكد من حذف هذا المريض نهائياً؟ لا يمكن التراجع.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl p-2.5 font-bold text-sm transition">إلغاء</button>
                <button onClick={confirmDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl p-2.5 font-bold text-sm transition shadow-md">حذف</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
