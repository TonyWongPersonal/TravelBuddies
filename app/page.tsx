'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// --- 資料型別 ---
interface ItineraryItem {
  id: string
  day_number: number
  date: string
  time_slot: string
  title: string
  guideline: string 
  photo_urls: string[]
  thoughts: string 
  google_maps_url: string
}

// --- 【設計器】優化手機端編輯體驗 ---
function UniversalDesigner({ 
  html, 
  onSave, 
  label = "",
  className = ""
}: { 
  html: string, 
  onSave: (newHtml: string) => void, 
  label?: string,
  className?: string
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
    span.style.lineHeight = '1.2'
    const range = selection.getRangeAt(0)
    range.surroundContents(span)
    if (editorRef.current) editorRef.current.focus()
  }

  if (isEditing) {
    return (
      <div className="fixed inset-0 z-[500] bg-stone-900/40 backdrop-blur-md flex items-center justify-center p-0 md:p-6 no-print">
        <div className="bg-white w-full h-full md:h-auto md:max-w-2xl md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
          <div className="p-4 md:p-8 border-b border-stone-100 flex overflow-x-auto gap-4 items-center bg-stone-50/50 scrollbar-hide">
            <div className="flex items-center gap-2 flex-shrink-0">
              {[24, 32, 48, 64].map((size) => (
                <button key={size} onMouseDown={(e) => setFontSize(e, size.toString())} className="w-10 h-10 rounded-lg bg-white border border-stone-100 text-[12px] font-bold active:bg-stone-100">{size}</button>
              ))}
            </div>
            <div className="w-[1px] h-6 bg-stone-200 flex-shrink-0"></div>
            <div className="flex gap-2 flex-shrink-0">
              <button onMouseDown={(e) => exec(e, 'foreColor', '#1c1917')} className="w-8 h-8 rounded-full bg-stone-900 border border-white shadow-sm"></button>
              <button onMouseDown={(e) => exec(e, 'foreColor', '#b08d57')} className="w-8 h-8 rounded-full bg-[#b08d57] border border-white shadow-sm"></button>
              <input type="color" onChange={(e) => exec(e, 'foreColor', (e.target as HTMLInputElement).value)} className="w-8 h-8 rounded-md cursor-pointer bg-transparent" />
            </div>
            <button onClick={() => setIsEditing(false)} className="ml-auto p-2 text-stone-300 text-2xl">✕</button>
          </div>
          <div ref={editorRef} contentEditable dangerouslySetInnerHTML={{ __html: html }} className="flex-1 p-8 md:p-12 focus:outline-none text-xl leading-relaxed text-stone-800 overflow-y-auto" />
          <div className="p-6 md:p-8 border-t border-stone-50 flex justify-end bg-white">
            <button onClick={handleSave} className="w-full md:w-auto bg-stone-900 text-white px-10 py-5 rounded-full font-bold text-[12px] uppercase tracking-widest shadow-xl active:scale-95">Save Design</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div onClick={() => setIsEditing(true)} className={`cursor-pointer hover:bg-stone-200/40 transition-all rounded-2xl p-2 -m-2 ${className}`} dangerouslySetInnerHTML={{ __html: html || `<span class="text-stone-300 italic">Edit ${label}</span>` }} />
  )
}

export default function TravelBuddies() {
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [bgColor, setBgColor] = useState('#ffd9b6')
  const [showUI, setShowUI] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

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
      const { data, error } = await supabase.from('honeymoon_itinerary').select('*')
      if (data) setItinerary(sortList(data))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function addJourney() {
    const { data, error } = await supabase.from('honeymoon_itinerary').insert([{}]).select()
    if (data) setItinerary(sortList([...itinerary, data[0]]))
  }

  async function handleUpdate(id: string, field: keyof ItineraryItem, value: any) {
    const updated = itinerary.map(item => item.id === id ? { ...item, [field]: value } : item)
    setItinerary(sortList(updated))
    await supabase.from('honeymoon_itinerary').update({ [field]: value }).eq('id', id)
  }

  async function handleUpload(id: string, file: File | undefined, currentPhotos: string[]) {
    if (!file) return
    const path = `uploads/${id}-${Date.now()}`
    await supabase.storage.from('honeymoon-photos').upload(path, file)
    const { data: { publicUrl } } = supabase.storage.from('honeymoon-photos').getPublicUrl(path)
    const newPhotos = [...(currentPhotos || []), publicUrl]
    await handleUpdate(id, 'photo_urls', newPhotos)
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f7f3ed] font-serif text-stone-300 animate-pulse">Journaling...</div>

  return (
    <div style={{ backgroundColor: bgColor }} className="min-h-screen text-stone-800 font-sans relative transition-colors duration-700">
      
      {/* --- 修正：強制打印背景色與頁碼 --- */}
      <style jsx global>{`
        @page { size: auto; margin: 0; }
        @media print {
          body, html, .min-h-screen { 
            background-color: ${bgColor} !important; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
          .page-break { 
            page-break-before: always; 
            padding: 40px !important;
            min-height: 100vh;
            position: relative;
          }
          .page-break::after {
            content: "Page " counter(pageNumber);
            position: absolute;
            bottom: 30px;
            left: 40px;
            font-family: serif;
            font-size: 10px;
            color: #999;
          }
          body { counter-reset: pageNumber; }
          .page-break { counter-increment: pageNumber; }
          .cover-page { counter-increment: none; }
          .cover-page::after { content: "" !important; }
        }
      `}</style>

      {/* 1. 封面區 */}
      <section className="h-screen w-full relative flex items-center justify-center overflow-hidden cover-page">
        <img src="https://bgvwsiqgbblgiggjlnfi.supabase.co/storage/v1/object/public/honeymoon-photos/cover.png" className="absolute inset-0 w-full h-full object-cover" alt="Cover" />
        <div className="absolute left-6 md:left-10 top-[40%] flex flex-col items-center gap-6 no-print">
          <div className="h-12 md:h-20 w-[0.5px] bg-stone-400/30"></div>
          <h1 className="[writing-mode:vertical-lr] text-[10px] md:text-xs font-serif font-bold tracking-[0.5em] text-stone-800/60 rotate-180 uppercase">TRAVEL BUDDIES</h1>
          <div className="h-12 md:h-20 w-[0.5px] bg-stone-400/30"></div>
        </div>
      </section>

      {/* 2. 行程清單 - 優化響應式字級 */}
      <main className="w-full max-w-7xl mx-auto py-16 md:py-48 px-5 md:px-10 space-y-24 md:space-y-64 relative">
        {itinerary.map((item, index) => (
          <section key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-24 items-start page-break">
            
            <div className="md:col-span-5 md:sticky md:top-24 space-y-6 md:space-y-12">
              <div className="flex items-center gap-6">
                <span className="text-3xl md:text-6xl font-serif italic text-stone-200/60">0{index + 1}</span>
                <div className="h-[0.5px] flex-1 bg-stone-200/50"></div>
              </div>

              {/* 修正：手機端標題字級由 text-4xl 降為 text-3xl */}
              <UniversalDesigner 
                label="標題" html={item.title} 
                onSave={(v) => handleUpdate(item.id, 'title', v)}
                className="text-3xl md:text-7xl font-serif font-bold text-stone-900 leading-tight block"
              />

              <div className="flex flex-col gap-3 font-mono text-[10px] md:text-[11px] text-stone-400 tracking-[0.4em] uppercase">
                <div className="flex gap-4 items-center"><span>DATE</span><UniversalDesigner html={item.date} onSave={(v) => handleUpdate(item.id, 'date', v)} className="text-stone-800" /></div>
                <div className="flex gap-4 items-center"><span>TIME</span><UniversalDesigner html={item.time_slot} onSave={(v) => handleUpdate(item.id, 'time_slot', v)} className="text-stone-800 font-bold" /></div>
              </div>

              <div className="bg-white/30 backdrop-blur-sm p-6 md:p-12 rounded-[2.5rem] md:rounded-[4rem] border border-stone-200/40 shadow-inner">
                <p className="text-[9px] font-black uppercase tracking-[0.5em] text-stone-400/50 mb-4 italic">溫馨提醒</p>
                <UniversalDesigner label="提醒" html={item.guideline} onSave={(v) => handleUpdate(item.id, 'guideline', v)} className="text-sm md:text-lg leading-relaxed text-stone-700 italic" />
              </div>

              <div className="flex gap-4 no-print pt-2">
                <a href={item.google_maps_url} target="_blank" className="flex-1 text-center py-4 bg-stone-900 text-stone-50 rounded-full font-bold text-[9px] tracking-[0.4em] uppercase shadow-xl active:scale-95">📍 MAP</a>
                <label className="flex-1 text-center py-4 border border-stone-300 text-stone-800 rounded-full font-bold text-[9px] tracking-[0.4em] uppercase cursor-pointer active:bg-white/50">📷 PHOTO<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleUpload(item.id, e.target.files?.[0], item.photo_urls)} /></label>
              </div>
            </div>

            <div className="md:col-span-7 space-y-12 md:space-y-24">
              <div className="grid grid-cols-1 gap-8 md:gap-14">
                {item.photo_urls?.length > 0 ? (
                  item.photo_urls.map((url, i) => (
                    <div key={i} className="rounded-[2rem] md:rounded-[3.5rem] overflow-hidden shadow-2xl border-[8px] md:border-[16px] border-white/80 p-0.5 bg-white/40">
                       <img src={url} className="w-full object-cover" />
                    </div>
                  ))
                ) : (
                  <div className="aspect-[4/3] bg-white/20 rounded-[2.5rem] md:rounded-[4rem] border border-dashed border-stone-300 flex items-center justify-center text-stone-300 italic font-serif text-sm">Waiting for memory...</div>
                )}
              </div>
              <div className="pt-10 md:pt-20 border-t border-stone-200/50">
                <label className="text-[10px] font-black text-stone-300 uppercase tracking-[0.7em] mb-6 block italic opacity-60 text-center md:text-left">Personal Diary</label>
                <UniversalDesigner label="日誌" html={item.thoughts} onSave={(v) => handleUpdate(item.id, 'thoughts', v)} className="min-h-[100px] text-lg md:text-2xl font-serif italic text-stone-500 leading-relaxed text-center md:text-left" />
              </div>
            </div>
          </section>
        ))}
      </main>

      {/* 3. 懸浮工具 - 手機端位置優化 */}
      <div className="fixed bottom-6 left-6 md:bottom-12 md:left-12 flex flex-col gap-4 no-print z-[300]">
        {showUI && (
          <div className="bg-white/95 backdrop-blur-md p-5 rounded-[2rem] shadow-2xl border border-stone-200 mb-2 animate-in slide-in-from-bottom-5">
             <div className="flex flex-col gap-3">
               <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">BG Color</span>
               <div className="flex items-center gap-2">
                 <input type="text" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="bg-stone-50 border border-stone-100 rounded-lg px-2 py-1.5 text-[10px] font-mono w-20" />
                 <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-6 h-6 cursor-pointer" />
               </div>
             </div>
          </div>
        )}
        <button onClick={() => setShowUI(!showUI)} className="w-14 h-14 bg-white border border-stone-200 rounded-full shadow-2xl flex items-center justify-center text-[10px] font-bold active:bg-stone-50 transition-colors">UI</button>
        <button onClick={addJourney} className="w-14 h-14 bg-white border border-stone-200 rounded-full shadow-2xl flex items-center justify-center text-2xl active:scale-90 transition-all">＋</button>
      </div>

      <div className="fixed bottom-6 right-6 md:bottom-12 md:right-12 no-print z-[300]">
        <button onClick={() => window.print()} className="w-14 h-14 bg-stone-900 text-stone-50 rounded-full shadow-2xl flex items-center justify-center font-bold text-[9px] tracking-widest active:scale-95 transition-all">PDF</button>
      </div>
    </div>
  )
}
