'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'

// --- 資料型別 ---
interface ItineraryItem {
  id: string; day_number: number; date: string; time_slot: string; title: string;
  guideline: string; photo_urls: string[]; thoughts: string; google_maps_url: string;
}

// --- 【1. 完整設計器】功能全開：字級、顏色、排版 ---
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
      <div className="fixed inset-0 z-[600] bg-stone-900/60 backdrop-blur-md flex items-center justify-center p-4 no-print">
        <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[80vh]">
          <div className="p-6 border-b flex overflow-x-auto gap-4 items-center bg-stone-50/50 scrollbar-hide">
            <div className="flex gap-2">
              {[24, 32, 48, 64].map(s => (
                <button key={s} onMouseDown={(e) => setFontSize(e, s.toString())} className="w-10 h-10 rounded-lg bg-white border text-[10px] font-bold active:bg-stone-100">{s}</button>
              ))}
            </div>
            <div className="w-[1px] h-6 bg-stone-200 mx-2" />
            <button onMouseDown={(e) => exec(e, 'foreColor', '#1c1917')} className="w-8 h-8 rounded-full bg-stone-900 border-2 border-white shadow-sm" />
            <button onMouseDown={(e) => exec(e, 'foreColor', '#b08d57')} className="w-8 h-8 rounded-full bg-[#b08d57] border-2 border-white shadow-sm" />
            <button onClick={() => setIsEditing(false)} className="ml-auto text-stone-300">✕</button>
          </div>
          <div ref={editorRef} contentEditable dangerouslySetInnerHTML={{ __html: html }} className="flex-1 p-12 focus:outline-none text-2xl leading-relaxed text-stone-800 overflow-y-auto" />
          <div className="p-8 border-t bg-white"><button onClick={handleSave} className="w-full bg-stone-900 text-white py-5 rounded-full font-bold uppercase tracking-[0.3em] text-[10px]">SAVE DESIGN</button></div>
        </div>
      </div>
    )
  }
  return <div onClick={() => setIsEditing(true)} className={`cursor-pointer hover:bg-white/40 transition-all rounded-2xl p-2 -m-2 ${className}`} dangerouslySetInnerHTML={{ __html: html || `<span class="text-stone-300 italic">Edit ${label}</span>` }} />
}

export default function TravelBuddies() {
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [bgColor, setBgColor] = useState('#ffd9b6')
  const [currentPage, setCurrentPage] = useState(0)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data } = await supabase.from('honeymoon_itinerary').select('*')
    if (data) setItinerary(data.sort((a, b) => {
        const clean = (s: string) => s ? s.replace(/<[^>]*>/g, '').trim() : ""
        return new Date(clean(a.date)).getTime() - new Date(clean(b.date)).getTime()
    }))
    setLoading(false)
  }

  async function handleUpdate(id: string, field: keyof ItineraryItem, value: any) {
    const updated = itinerary.map(item => item.id === id ? { ...item, [field]: value } : item)
    setItinerary(updated)
    await supabase.from('honeymoon_itinerary').update({ [field]: value }).eq('id', id)
  }

  // --- 【功能升級：多圖上傳】 ---
  async function handleBatchUpload(id: string, files: FileList | null, currentPhotos: string[]) {
    if (!files) return;
    const uploadedUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = `uploads/${id}-${Date.now()}-${i}`;
        await supabase.storage.from('honeymoon-photos').upload(path, file);
        const { data: { publicUrl } } = supabase.storage.from('honeymoon-photos').getPublicUrl(path);
        uploadedUrls.push(publicUrl);
    }
    const newPhotos = [...(currentPhotos || []), ...uploadedUrls];
    await handleUpdate(id, 'photo_urls', newPhotos);
  }

  async function addJourney() {
    const { data } = await supabase.from('honeymoon_itinerary').insert([{ title: '<div>New Day</div>', photo_urls: [] }]).select()
    if (data) {
        setItinerary([...itinerary, data[0]])
        setCurrentPage(itinerary.length + 1)
    }
  }

  const allPages = [{ type: 'cover' }, ...itinerary.map(item => ({ type: 'itinerary', ...item }))];
  const nextPage = () => currentPage < allPages.length - 1 && setCurrentPage(currentPage + 1)
  const prevPage = () => currentPage > 0 && setCurrentPage(currentPage - 1)

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f7f3ed] font-serif">Journaling...</div>

  return (
    <div style={{ backgroundColor: bgColor }} className="h-screen w-screen overflow-hidden text-stone-800 font-sans relative">
      
      {/* 【一鍵成書：列印邏輯】強制全本背景色與分頁 */}
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 0; }
          body, html { background: none !important; }
          .no-print { display: none !important; }
          .print-container { display: block !important; }
          .print-page { 
            width: 210mm; height: 297mm; 
            background-color: ${bgColor} !important; 
            -webkit-print-color-adjust: exact !important;
            page-break-after: always;
            padding: 20mm;
            display: flex; flex-direction: column;
          }
        }
      `}</style>

      {/* 翻頁區域 */}
      <div className="absolute inset-y-0 left-0 w-24 z-50 cursor-pointer no-print" onClick={prevPage} />
      <div className="absolute inset-y-0 right-0 w-24 z-50 cursor-pointer no-print" onClick={nextPage} />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          className="h-full w-full flex items-center justify-center p-4 md:p-8 no-print"
        >
          {/* 書本容器：黃金比例且內部捲動 */}
          <div className="w-full max-w-[550px] aspect-[1/1.41] bg-white/40 backdrop-blur-md rounded-[3rem] shadow-2xl border border-white/60 flex flex-col overflow-hidden relative">
            
            {allPages[currentPage].type === 'cover' ? (
              // 【封面：Full 版】
              <div className="flex-1 relative flex flex-col items-center justify-center text-center p-0">
                 <img src="https://bgvwsiqgbblgiggjlnfi.supabase.co/storage/v1/object/public/honeymoon-photos/cover.png" className="absolute inset-0 w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-black/20" />
                 <div className="relative z-10 text-white drop-shadow-2xl px-10">
                   <h1 className="text-5xl md:text-8xl font-serif font-bold tracking-tighter leading-none mb-6">我們的台灣<br/>三人蜜月</h1>
                   <div className="h-1 w-20 bg-white/80 mx-auto" />
                 </div>
              </div>
            ) : (
              // 【行程內容頁】
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-10 pb-0 flex items-center gap-6">
                  <span className="text-4xl font-serif italic text-stone-300">0{currentPage}</span>
                  <div className="h-[0.5px] flex-1 bg-stone-200" />
                </div>
                
                {/* 內容捲動區：確保背景不動，內容動 */}
                <div className="flex-1 overflow-y-auto scrollbar-hide p-10 pt-6 space-y-10">
                   <UniversalDesigner label="標題" html={(allPages[currentPage] as any).title} onSave={(v) => handleUpdate((allPages[currentPage] as any).id, 'title', v)} className="text-4xl md:text-6xl font-serif font-bold leading-tight" />
                   <div className="bg-white/50 p-8 rounded-[2.5rem] shadow-inner border border-white/40 italic">
                     <UniversalDesigner label="提醒" html={(allPages[currentPage] as any).guideline} onSave={(v) => handleUpdate((allPages[currentPage] as any).id, 'guideline', v)} className="text-lg text-stone-600" />
                   </div>
                   <div className="grid grid-cols-1 gap-6">
                      {(allPages[currentPage] as any).photo_urls?.map((url: string, i: number) => (
                        <img key={i} src={url} className="w-full rounded-[2.5rem] shadow-xl border-[10px] border-white" />
                      ))}
                   </div>
                   <UniversalDesigner label="日誌" html={(allPages[currentPage] as any).thoughts} className="text-xl md:text-2xl font-serif italic text-stone-500 pb-20" onSave={(v) => handleUpdate((allPages[currentPage] as any).id, 'thoughts', v)} />
                </div>

                {/* 底部功能區 */}
                <div className="p-8 border-t border-white/20 bg-white/10 backdrop-blur-md flex gap-4 no-print">
                   <label className="flex-1 text-center py-5 bg-stone-900 text-white rounded-full text-[10px] font-bold tracking-widest cursor-pointer shadow-xl">
                      📷 MULTI UPLOAD
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleBatchUpload((allPages[currentPage] as any).id, e.target.files, (allPages[currentPage] as any).photo_urls)} />
                   </label>
                </div>
              </div>
            )}
            <div className="absolute bottom-6 left-0 right-0 text-center font-serif text-[10px] text-stone-300 no-print">PAGE {currentPage + 1} / {allPages.length}</div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 【一鍵成書：隱藏列印容器】渲染全部頁面供 PDF 使用 */}
      <div className="hidden print-container">
        {allPages.map((page, idx) => (
          <div key={idx} className="print-page">
            {page.type === 'cover' ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                 <img src="https://bgvwsiqgbblgiggjlnfi.supabase.co/storage/v1/object/public/honeymoon-photos/cover.png" className="w-80 h-80 object-cover rounded-full border-[20px] border-white" />
                 <h1 className="text-7xl font-serif font-bold mt-12">我們的台灣三人蜜月</h1>
              </div>
            ) : (
              <div className="space-y-10">
                <div className="text-8xl font-serif italic text-white/50">0{idx}</div>
                <div className="text-6xl font-serif font-bold" dangerouslySetInnerHTML={{ __html: (page as any).title }} />
                <div className="bg-white/40 p-10 rounded-[3rem] text-2xl italic" dangerouslySetInnerHTML={{ __html: (page as any).guideline }} />
                <div className="grid grid-cols-1 gap-6">
                  {(page as any).photo_urls?.map((url: string, i: number) => (
                    <img key={i} src={url} className="w-full rounded-[3rem] border-[15px] border-white" />
                  ))}
                </div>
                <div className="text-3xl font-serif italic text-stone-600" dangerouslySetInnerHTML={{ __html: (page as any).thoughts }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 底部工具 */}
      <div className="fixed bottom-8 right-8 flex items-center gap-5 no-print z-[300]">
        <button onClick={addJourney} className="w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-3xl">+</button>
        <div className="bg-white/90 backdrop-blur-md rounded-full px-6 py-4 shadow-2xl flex items-center gap-4">
           <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-8 h-8 rounded-full cursor-pointer bg-transparent border-none" />
           <button onClick={() => window.print()} className="text-[10px] font-black tracking-widest uppercase">一鍵成書 (PDF)</button>
        </div>
      </div>
    </div>
  )
}