'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'

// --- 1. 資料型別定義 ---
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

// --- 2. 【核心設計器】完整版：包含字級、顏色、保存 ---
function UniversalDesigner({ 
  html, onSave, label = "", className = ""
}: { 
  html: string, onSave: (newHtml: string) => void, label?: string, className?: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  const handleSave = () => {
    if (editorRef.current) onSave(editorRef.current.innerHTML)
    setIsEditing(false)
  }

  const exec = (e: React.BaseSyntheticEvent, cmd: string, val: string = "") => {
    e.preventDefault() 
    document.execCommand(cmd, false, val)
    if (editorRef.current) editorRef.current.focus()
  }

  const setFontSize = (e: React.MouseEvent, size: string) => {
    e.preventDefault()
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const span = document.createElement('span')
    span.style.fontSize = `${size}px`
    const range = selection.getRangeAt(0)
    range.surroundContents(span)
  }

  if (isEditing) {
    return (
      <div className="fixed inset-0 z-[600] bg-stone-900/60 backdrop-blur-md flex items-center justify-center p-0 md:p-6 no-print">
        <div className="bg-white w-full h-full md:h-auto md:max-w-2xl md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
          <div className="p-4 md:p-8 border-b flex overflow-x-auto gap-4 items-center bg-stone-50/50">
            <div className="flex gap-2">
              {[24, 32, 48, 64].map((s) => (
                <button key={s} onMouseDown={(e) => setFontSize(e, s.toString())} className="w-10 h-10 rounded-lg bg-white border text-[10px] font-bold">{s}</button>
              ))}
            </div>
            <div className="w-[1px] h-6 bg-stone-200 mx-2"></div>
            <button onMouseDown={(e) => exec(e, 'foreColor', '#1c1917')} className="w-8 h-8 rounded-full bg-stone-900 border-2 border-white shadow-sm"></button>
            <button onMouseDown={(e) => exec(e, 'foreColor', '#b08d57')} className="w-8 h-8 rounded-full bg-[#b08d57] border-2 border-white shadow-sm"></button>
            <button onClick={() => setIsEditing(false)} className="ml-auto p-2 text-stone-300">✕</button>
          </div>
          <div ref={editorRef} contentEditable dangerouslySetInnerHTML={{ __html: html }} className="flex-1 p-8 md:p-12 focus:outline-none text-xl leading-relaxed text-stone-800 overflow-y-auto" />
          <div className="p-6 md:p-8 border-t"><button onClick={handleSave} className="w-full bg-stone-900 text-white py-5 rounded-full font-bold uppercase tracking-widest text-[10px]">SAVE DESIGN</button></div>
        </div>
      </div>
    )
  }
  return <div onClick={() => setIsEditing(true)} className={`cursor-pointer hover:bg-white/40 transition-all rounded-2xl p-2 -m-2 ${className}`} dangerouslySetInnerHTML={{ __html: html || `<span class="text-stone-300 italic">Edit ${label}</span>` }} />
}

// --- 3. 主頁面組件 ---
export default function TravelBuddies() {
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [bgColor, setBgColor] = useState('#ffd9b6')
  const [currentPage, setCurrentPage] = useState(0)

  useEffect(() => { fetchData() }, [])

  // 排序函數：確保行程按日期時間正確排列
  const sortList = (list: ItineraryItem[]) => {
    const clean = (str: string) => str ? str.replace(/<[^>]*>/g, '').replace(/\./g, '-').trim() : ""
    return [...list].sort((a, b) => {
      try {
        const tA = new Date(`${clean(a.date)} ${clean(a.time_slot)}`).getTime()
        const tB = new Date(`${clean(b.date)} ${clean(b.time_slot)}`).getTime()
        return (tA || 0) - (tB || 0)
      } catch (e) { return 0 }
    })
  }

  async function fetchData() {
    try {
      const { data } = await supabase.from('honeymoon_itinerary').select('*')
      if (data) setItinerary(sortList(data))
    } finally { setLoading(false) }
  }

  async function handleUpdate(id: string, field: keyof ItineraryItem, value: any) {
    const updated = itinerary.map(item => item.id === id ? { ...item, [field]: value } : item)
    setItinerary(sortList(updated))
    await supabase.from('honeymoon_itinerary').update({ [field]: value }).eq('id', id)
  }

  // 增加行程邏輯
  async function addJourney() {
    const { data } = await supabase.from('honeymoon_itinerary').insert([{}]).select()
    if (data) {
      const newList = sortList([...itinerary, data[0]])
      setItinerary(newList)
      setCurrentPage(newList.length) // 跳转到新页
    }
  }

  // 上傳照片：移除 capture，支援相簿
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

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f7f3ed] font-serif animate-pulse">Journaling...</div>

  return (
    <div style={{ backgroundColor: bgColor }} className="h-screen w-screen overflow-hidden text-stone-800 font-sans relative transition-colors duration-700">
      
      {/* 4. 列印與背景同步樣式 */}
      <style jsx global>{`
        @media print {
          body, html, .min-h-screen { 
            background-color: ${bgColor} !important; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
          .book-page { 
            width: 210mm !important; 
            height: 297mm !important; 
            margin: 0 !important; 
            padding: 20mm !important;
            page-break-after: always !important; 
            background-color: ${bgColor} !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      {/* 5. 翻頁導航熱區 */}
      <div className="absolute inset-y-0 left-0 w-20 z-[100] cursor-pointer no-print" onClick={prevPage} title="Previous Page" />
      <div className="absolute inset-y-0 right-0 w-20 z-[100] cursor-pointer no-print" onClick={nextPage} title="Next Page" />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="h-full w-full flex items-center justify-center p-4 md:p-10"
        >
          {/* 書本內頁：採用 A4 黃金比例 aspect-[1/1.414] */}
          <div className="book-page w-full max-w-[550px] aspect-[1/1.414] bg-white/40 backdrop-blur-md rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] border border-white/60 p-8 md:p-14 relative flex flex-col overflow-hidden">
            
            {allPages[currentPage].type === 'cover' ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-10">
                 <img src="https://bgvwsiqgbblgiggjlnfi.supabase.co/storage/v1/object/public/honeymoon-photos/cover.png" className="w-56 h-56 object-cover rounded-full border-[10px] border-white shadow-2xl" />
                 <h1 className="text-5xl md:text-7xl font-serif font-bold tracking-tighter leading-none">我們的台灣<br/>三人蜜月</h1>
                 <div className="h-20 w-[1px] bg-stone-300"></div>
                 <p className="font-mono text-[9px] tracking-[0.5em] text-stone-400 uppercase">Touch sides to flip journal</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center gap-6 mb-10">
                  <span className="text-4xl font-serif italic text-stone-300">0{currentPage}</span>
                  <div className="h-[1px] flex-1 bg-stone-200"></div>
                  <span className="text-[10px] font-mono tracking-widest text-stone-300">ITINERARY</span>
                </div>
                
                <UniversalDesigner label="標題" html={(allPages[currentPage] as any).title} onSave={(v) => handleUpdate((allPages[currentPage] as any).id, 'title', v)} className="text-4xl md:text-6xl font-serif font-bold text-stone-900 leading-tight mb-8" />

                <div className="flex-1 overflow-y-auto scrollbar-hide space-y-10 pr-2">
                   <div className="bg-white/50 p-8 rounded-[2rem] border border-white/30 italic text-stone-600 shadow-inner">
                     <UniversalDesigner label="提醒" html={(allPages[currentPage] as any).guideline} onSave={(v) => handleUpdate((allPages[currentPage] as any).id, 'guideline', v)} className="text-lg" />
                   </div>
                   
                   <div className="grid grid-cols-1 gap-6">
                      {(allPages[currentPage] as any).photo_urls?.map((url: string, i: number) => (
                        <img key={i} src={url} className="w-full rounded-[2.5rem] shadow-xl border-[12px] border-white" />
                      ))}
                   </div>
                   
                   <div className="pb-10">
                      <label className="text-[9px] font-black text-stone-300 uppercase tracking-widest mb-4 block italic">Personal Thoughts</label>
                      <UniversalDesigner label="日誌" html={(allPages[currentPage] as any).thoughts} className="text-xl font-serif leading-relaxed text-stone-500" onSave={(v) => handleUpdate((allPages[currentPage] as any).id, 'thoughts', v)} />
                   </div>
                </div>

                {/* 底部功能區 */}
                <div className="mt-6 pt-6 border-t border-white/20 flex gap-4 no-print">
                   <a href={(allPages[currentPage] as any).google_maps_url} target="_blank" className="flex-1 text-center py-4 bg-stone-900 text-white rounded-full text-[9px] font-bold tracking-[0.2em] uppercase">📍 Maps</a>
                   <label className="flex-1 text-center py-4 border-2 border-stone-300 text-stone-800 rounded-full text-[9px] font-bold tracking-[0.2em] uppercase cursor-pointer hover:bg-white">
                      📷 Album
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload((allPages[currentPage] as any).id, e.target.files?.[0], (allPages[currentPage] as any).photo_urls)} />
                   </label>
                </div>
              </div>
            )}
            
            <div className="absolute bottom-6 left-0 right-0 text-center font-serif text-[9px] text-stone-300 tracking-[0.4em]">
               - {currentPage + 1} / {allPages.length} -
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 懸浮控制台 */}
      <div className="fixed bottom-6 right-6 flex items-center gap-4 no-print z-[200]">
        <button onClick={addJourney} className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center text-2xl">+</button>
        <div className="flex items-center bg-white rounded-full px-4 h-12 shadow-xl border border-stone-100 gap-3">
           <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-6 h-6 border-none cursor-pointer bg-transparent" />
           <button onClick={() => window.print()} className="text-[9px] font-bold tracking-widest uppercase">一鍵成書 (PDF)</button>
        </div>
      </div>
    </div>
  )
}