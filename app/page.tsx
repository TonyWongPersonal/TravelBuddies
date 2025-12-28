'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'

// --- 資料型別 ---
interface ItineraryItem {
  id: string; day_number: number; date: string; time_slot: string; title: string;
  guideline: string; photo_urls: string[]; thoughts: string; google_maps_url: string;
}

// --- 【設計器】保持不變 ---
function UniversalDesigner({ html, onSave, label = "", className = "" }: { html: string, onSave: (newHtml: string) => void, label?: string, className?: string }) {
  const [isEditing, setIsEditing] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const handleSave = () => { if (editorRef.current) onSave(editorRef.current.innerHTML); setIsEditing(false); }
  const exec = (e: React.BaseSyntheticEvent, cmd: string, val: string = "") => { e.preventDefault(); document.execCommand(cmd, false, val); if (editorRef.current) editorRef.current.focus(); }
  if (isEditing) {
    return (
      <div className="fixed inset-0 z-[500] bg-stone-900/40 backdrop-blur-md flex items-center justify-center p-0 md:p-6 no-print">
        <div className="bg-white w-full h-full md:h-auto md:max-w-2xl md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-stone-100 flex overflow-x-auto gap-4 bg-stone-50/50">
             <button onMouseDown={(e) => exec(e, 'foreColor', '#b08d57')} className="w-8 h-8 rounded-full bg-[#b08d57] border border-white" />
             <button onClick={() => setIsEditing(false)} className="ml-auto text-stone-300">✕</button>
          </div>
          <div ref={editorRef} contentEditable dangerouslySetInnerHTML={{ __html: html }} className="flex-1 p-8 focus:outline-none text-xl leading-relaxed overflow-y-auto" />
          <button onClick={handleSave} className="m-6 bg-stone-900 text-white py-4 rounded-full font-bold uppercase text-[10px] tracking-widest">Save Design</button>
        </div>
      </div>
    )
  }
  return <div onClick={() => setIsEditing(true)} className={`cursor-pointer rounded-2xl p-2 -m-2 ${className}`} dangerouslySetInnerHTML={{ __html: html || `<span class="text-stone-300 italic">Edit ${label}</span>` }} />
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

  async function handleUpdate(id: string, field: keyof ItineraryItem, value: any) {
    const updated = itinerary.map(item => item.id === id ? { ...item, [field]: value } : item)
    setItinerary(updated)
    await supabase.from('honeymoon_itinerary').update({ [field]: value }).eq('id', id)
  }

  const allPages = [{ type: 'cover' }, ...itinerary.map(item => ({ type: 'itinerary', ...item }))];
  const nextPage = () => setCurrentPage((prev) => (prev + 1) % allPages.length)
  const prevPage = () => setCurrentPage((prev) => (prev - 1 + allPages.length) % allPages.length)

  // --- 手勢處理：滑動翻頁 ---
  const handleDragEnd = (event: any, info: any) => {
    if (info.offset.x < -100) nextPage(); // 向左滑 -> 下一頁
    if (info.offset.x > 100) prevPage();  // 向右滑 -> 上一頁
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f7f3ed] font-serif text-stone-300 animate-pulse">Opening Memories...</div>

  return (
    <div style={{ backgroundColor: bgColor }} className="h-screen w-screen overflow-hidden text-stone-800 font-sans relative transition-colors duration-700 select-none">
      
      {/* 左右控制按鈕 (僅桌面端顯示方便調試) */}
      <div className="absolute inset-0 flex items-center justify-between px-4 z-10 no-print pointer-events-none hidden md:flex">
        <button onClick={prevPage} className="pointer-events-auto w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl">‹</button>
        <button onClick={nextPage} className="pointer-events-auto w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl">›</button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          // --- 3D 翻書效果 ---
          initial={{ rotateY: 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          exit={{ rotateY: -90, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          style={{ transformOrigin: "left center", perspective: 2000 }}
          // --- 手勢與滑動 ---
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          className="h-full w-full flex items-center justify-center p-4 md:p-10 touch-none"
        >
          <div className="w-full max-w-4xl h-full max-h-[90vh] bg-white/40 backdrop-blur-sm rounded-[3rem] shadow-2xl border border-white/60 overflow-y-auto scrollbar-hide p-8 md:p-16 relative">
            
            {allPages[currentPage].type === 'cover' ? (
              // --- 封面頁：點擊即開啟 ---
              <div onClick={nextPage} className="h-full flex flex-col items-center justify-center gap-12 text-center cursor-pointer group">
                 <motion.img 
                   animate={{ scale: [1, 1.05, 1] }} 
                   transition={{ duration: 4, repeat: Infinity }}
                   src="https://bgvwsiqgbblgiggjlnfi.supabase.co/storage/v1/object/public/honeymoon-photos/cover.png" 
                   className="w-48 h-48 md:w-64 md:h-64 object-cover rounded-full shadow-2xl border-4 border-white" 
                 />
                 <h1 className="text-4xl md:text-6xl font-serif font-bold tracking-tighter group-hover:text-[#b08d57] transition-colors">我們的台灣<br/>三人蜜月</h1>
                 <div className="space-y-2">
                    <p className="font-mono text-[10px] tracking-[0.5em] text-stone-400">SWIPE OR CLICK TO OPEN</p>
                    <div className="w-8 h-0.5 bg-stone-300 mx-auto"></div>
                 </div>
              </div>
            ) : (
              // --- 行程頁面 ---
              <div className="space-y-12">
                <div className="flex items-center gap-4">
                  <span className="text-5xl font-serif italic text-stone-200">0{currentPage}</span>
                  <div className="h-[0.5px] flex-1 bg-stone-200" />
                  <span className="text-[10px] font-mono tracking-widest text-stone-300">DAY {currentPage}</span>
                </div>
                
                <UniversalDesigner 
                  label="標題" html={(allPages[currentPage] as any).title} 
                  onSave={(v) => handleUpdate((allPages[currentPage] as any).id, 'title', v)}
                  className="text-3xl md:text-6xl font-serif font-bold text-stone-900 leading-tight"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   <div className="space-y-6">
                      <div className="bg-white/50 p-6 rounded-[2rem] border border-white/40 italic text-stone-600 shadow-inner">
                        <UniversalDesigner label="提醒" html={(allPages[currentPage] as any).guideline} onSave={(v) => handleUpdate((allPages[currentPage] as any).id, 'guideline', v)} />
                      </div>
                      <UniversalDesigner label="日誌" html={(allPages[currentPage] as any).thoughts} className="text-lg font-serif leading-relaxed text-stone-500" onSave={(v) => handleUpdate((allPages[currentPage] as any).id, 'thoughts', v)} />
                   </div>
                   
                   <div className="space-y-4">
                      {(allPages[currentPage] as any).photo_urls?.map((url: string, i: number) => (
                        <motion.img whileHover={{ scale: 1.05 }} key={i} src={url} className="w-full rounded-[2rem] shadow-lg border-4 border-white" />
                      ))}
                      <div className="flex gap-4 pt-4">
                        <a href={(allPages[currentPage] as any).google_maps_url} target="_blank" className="flex-1 text-center py-4 bg-stone-900 text-white rounded-full text-[9px] font-bold tracking-widest shadow-lg">📍 GOOGLE MAPS</a>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {/* 頁碼底部 */}
            <div className="absolute bottom-8 left-0 right-0 text-center font-serif text-[10px] text-stone-300 tracking-widest">
              PAGE {currentPage + 1} OF {allPages.length}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 懸浮添加按鈕 */}
      <button onClick={() => { /* 可以保留之前的 addJourney 邏輯 */ }} className="fixed bottom-6 right-6 w-12 h-12 bg-white rounded-full shadow-2xl flex items-center justify-center text-xl no-print z-50">＋</button>
    </div>
  )
}
