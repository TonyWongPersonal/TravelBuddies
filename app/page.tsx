'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'

// --- 資料型別 ---
interface ItineraryItem {
  id: string;
  day_number: number;
  date: string;
  time_slot: string;
  title: string;
  guideline: string; 
  photo_urls: string[];
  thoughts: string; 
  google_maps_url: string;
}

// --- 【設計器】完整版 (恢復顏色、大小選擇) ---
function UniversalDesigner({ html, onSave, label = "", className = "" }: { html: string, onSave: (newHtml: string) => void, label?: string, className?: string }) {
  const [isEditing, setIsEditing] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  const handleSave = () => { if (editorRef.current) onSave(editorRef.current.innerHTML); setIsEditing(false); }
  const exec = (e: React.BaseSyntheticEvent, cmd: string, val: string = "") => {
    e.preventDefault(); document.execCommand(cmd, false, val); if (editorRef.current) editorRef.current.focus();
  }
  const setFontSize = (e: React.MouseEvent, size: string) => {
    e.preventDefault();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const span = document.createElement('span');
    span.style.fontSize = `${size}px`;
    const range = selection.getRangeAt(0);
    range.surroundContents(span);
  }

  if (isEditing) {
    return (
      <div className="fixed inset-0 z-[600] bg-stone-900/40 backdrop-blur-md flex items-center justify-center p-0 md:p-6 no-print">
        <div className="bg-white w-full h-full md:h-auto md:max-w-2xl md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-stone-100 flex overflow-x-auto gap-4 items-center bg-stone-50/50">
            {[24, 32, 48].map(s => (
              <button key={s} onMouseDown={(e) => setFontSize(e, s.toString())} className="px-3 py-1 bg-white border rounded text-[10px]">{s}</button>
            ))}
            <div className="w-[1px] h-6 bg-stone-200 mx-2"></div>
            <button onMouseDown={(e) => exec(e, 'foreColor', '#1c1917')} className="w-6 h-6 rounded-full bg-stone-900 border border-white" />
            <button onMouseDown={(e) => exec(e, 'foreColor', '#b08d57')} className="w-6 h-6 rounded-full bg-[#b08d57] border border-white" />
            <button onClick={() => setIsEditing(false)} className="ml-auto p-2 text-stone-300">✕</button>
          </div>
          <div ref={editorRef} contentEditable dangerouslySetInnerHTML={{ __html: html }} className="flex-1 p-8 focus:outline-none text-xl leading-relaxed overflow-y-auto" />
          <div className="p-6 border-t bg-stone-50"><button onClick={handleSave} className="w-full bg-stone-900 text-white py-4 rounded-full font-bold uppercase text-[10px] tracking-widest">Save Design</button></div>
        </div>
      </div>
    )
  }
  return <div onClick={() => setIsEditing(true)} className={`cursor-pointer hover:bg-white/40 transition-all rounded-xl p-2 -m-2 ${className}`} dangerouslySetInnerHTML={{ __html: html || `<span class="text-stone-300 italic">Edit ${label}</span>` }} />
}

export default function TravelBuddies() {
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [bgColor, setBgColor] = useState('#ffd9b6')
  const [currentPage, setCurrentPage] = useState(0)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    try {
      const { data } = await supabase.from('honeymoon_itinerary').select('*')
      if (data) setItinerary(data.sort((a, b) => a.day_number - b.day_number))
    } finally { setLoading(false) }
  }

  // --- 恢復：添加行程 ---
  async function addJourney() {
    const { data } = await supabase.from('honeymoon_itinerary').insert([{ day_number: itinerary.length + 1, title: '<div>新旅程</div>', date: '2026.01.01' }]).select()
    if (data) {
      setItinerary([...itinerary, data[0]])
      setCurrentPage(itinerary.length + 1)
    }
  }

  async function handleUpdate(id: string, field: keyof ItineraryItem, value: any) {
    const updated = itinerary.map(item => item.id === id ? { ...item, [field]: value } : item)
    setItinerary(updated)
    await supabase.from('honeymoon_itinerary').update({ [field]: value }).eq('id', id)
  }

  // --- 恢復：照片上傳 ---
  async function handleUpload(id: string, file: File | undefined, currentPhotos: string[]) {
    if (!file) return
    const path = `uploads/${id}-${Date.now()}`
    await supabase.storage.from('honeymoon-photos').upload(path, file)
    const { data: { publicUrl } } = supabase.storage.from('honeymoon-photos').getPublicUrl(path)
    const newPhotos = [...(currentPhotos || []), publicUrl]
    await handleUpdate(id, 'photo_urls', newPhotos)
  }

  const allPages = [{ type: 'cover' }, ...itinerary.map(item => ({ type: 'itinerary', ...item }))];
  const nextPage = () => currentPage < allPages.length - 1 && setCurrentPage(currentPage + 1)
  const prevPage = () => currentPage > 0 && setCurrentPage(currentPage - 1)

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f7f3ed] font-serif text-stone-300 animate-pulse">Opening Memories...</div>

  return (
    <div style={{ backgroundColor: bgColor }} className="h-screen w-screen overflow-hidden text-stone-800 font-sans relative">
      
      {/* 側邊翻頁熱區 (固定式) */}
      <div className="absolute inset-y-0 left-0 w-16 md:w-32 z-50 cursor-pointer no-print" onClick={prevPage} />
      <div className="absolute inset-y-0 right-0 w-16 md:w-32 z-50 cursor-pointer no-print" onClick={nextPage} />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.4 }}
          className="h-full w-full flex items-center justify-center p-4 md:p-10"
        >
          <div className="w-full max-w-5xl h-full max-h-[92vh] bg-white/40 backdrop-blur-sm rounded-[3rem] shadow-2xl border border-white/60 overflow-y-auto scrollbar-hide p-8 md:p-16 relative">
            
            {allPages[currentPage].type === 'cover' ? (
              <div className="h-full flex flex-col items-center justify-center gap-12 text-center">
                 <img src="https://bgvwsiqgbblgiggjlnfi.supabase.co/storage/v1/object/public/honeymoon-photos/cover.png" className="w-48 h-48 md:w-72 md:h-72 object-cover rounded-full shadow-2xl border-8 border-white" />
                 <h1 className="text-5xl md:text-8xl font-serif font-bold tracking-tighter">我們的台灣<br/>三人蜜月</h1>
                 <p className="font-mono text-[10px] tracking-[0.5em] text-stone-400">CLICK SIDES TO FLIP</p>
              </div>
            ) : (
              <div className="space-y-12">
                <div className="flex items-center gap-6">
                  <span className="text-4xl md:text-6xl font-serif italic text-stone-300">0{currentPage}</span>
                  <div className="h-[1px] flex-1 bg-stone-200" />
                  <button onClick={addJourney} className="no-print w-10 h-10 rounded-full border border-stone-200 flex items-center justify-center text-stone-300 hover:bg-white">+</button>
                </div>
                
                <UniversalDesigner label="標題" html={(allPages[currentPage] as any).title} onSave={(v) => handleUpdate((allPages[currentPage] as any).id, 'title', v)} className="text-4xl md:text-7xl font-serif font-bold text-stone-900 leading-tight" />

                <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
                   <div className="md:col-span-5 space-y-8">
                      <div className="bg-white/60 p-8 rounded-[2.5rem] shadow-inner border border-white/40">
                        <UniversalDesigner label="提醒" html={(allPages[currentPage] as any).guideline} onSave={(v) => handleUpdate((allPages[currentPage] as any).id, 'guideline', v)} className="text-lg italic text-stone-600" />
                      </div>
                      <UniversalDesigner label="日誌" html={(allPages[currentPage] as any).thoughts} className="text-xl md:text-2xl font-serif leading-relaxed text-stone-500" onSave={(v) => handleUpdate((allPages[currentPage] as any).id, 'thoughts', v)} />
                   </div>
                   
                   <div className="md:col-span-7 space-y-6">
                      <div className="grid grid-cols-1 gap-6">
                        {(allPages[currentPage] as any).photo_urls?.map((url: string, i: number) => (
                          <img key={i} src={url} className="w-full rounded-[2.5rem] shadow-xl border-[12px] border-white" />
                        ))}
                      </div>
                      
                      {/* --- 恢復：照片上傳按鈕 --- */}
                      <div className="flex gap-4 pt-4 no-print">
                        <a href={(allPages[currentPage] as any).google_maps_url} target="_blank" className="flex-1 text-center py-5 bg-stone-900 text-white rounded-full text-[10px] font-bold tracking-[0.3em] uppercase">📍 Google Maps</a>
                        <label className="flex-1 text-center py-5 border-2 border-stone-300 rounded-full text-[10px] font-bold tracking-[0.3em] uppercase cursor-pointer hover:bg-white">
                           📷 Upload Photo
                           <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleUpload((allPages[currentPage] as any).id, e.target.files?.[0], (allPages[currentPage] as any).photo_urls)} />
                        </label>
                      </div>
                   </div>
                </div>
              </div>
            )}

            <div className="absolute bottom-8 left-0 right-0 text-center font-serif text-[10px] text-stone-300 tracking-[0.5em] no-print">
              PAGE {currentPage + 1} / {allPages.length}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 功能按鈕 */}
      <div className="fixed bottom-6 right-6 flex gap-4 no-print z-[100]">
        <button onClick={() => window.print()} className="w-12 h-12 bg-stone-900 text-white rounded-full shadow-xl flex items-center justify-center text-[10px] font-bold">PDF</button>
      </div>
    </div>
  )
}