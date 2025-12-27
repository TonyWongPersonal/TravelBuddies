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

// --- 【通用設計器】支持：顏色、大小、換行、按鈕焦點修復 ---
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

  // 核心修復：使用 onMouseDown 與 preventDefault 防止按鈕搶走編輯框焦點
  const exec = (e: React.MouseEvent, cmd: string, val: string = "") => {
    e.preventDefault() 
    document.execCommand(cmd, false, val)
    if (editorRef.current) editorRef.current.focus()
  }

  if (isEditing) {
    return (
      <div className="fixed inset-0 z-[400] bg-stone-900/20 backdrop-blur-md flex items-center justify-center p-6 no-print">
        <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
            <div className="flex gap-4">
              {/* 字級控制 */}
              <button onMouseDown={(e) => exec(e, 'fontSize', '3')} className="w-8 h-8 rounded-lg hover:bg-stone-200 flex items-center justify-center font-bold text-stone-300">小</button>
              <button onMouseDown={(e) => exec(e, 'fontSize', '5')} className="w-8 h-8 rounded-lg hover:bg-stone-200 flex items-center justify-center font-bold text-stone-600">中</button>
              <button onMouseDown={(e) => exec(e, 'fontSize', '7')} className="w-8 h-8 rounded-lg hover:bg-stone-200 flex items-center justify-center font-bold text-stone-900">大</button>
              <div className="w-[1px] bg-stone-200 mx-2"></div>
              {/* 顏色控制 */}
              <button onMouseDown={(e) => exec(e, 'foreColor', '#1c1917')} className="w-6 h-6 rounded-full bg-stone-900 mt-1 shadow-sm border border-stone-100"></button>
              <button onMouseDown={(e) => exec(e, 'foreColor', '#d97706')} className="w-6 h-6 rounded-full bg-amber-600 mt-1 shadow-sm border border-stone-100"></button>
              <button onMouseDown={(e) => exec(e, 'foreColor', '#be123c')} className="w-6 h-6 rounded-full bg-rose-700 mt-1 shadow-sm border border-stone-100"></button>
            </div>
            <button onClick={() => setIsEditing(false)} className="text-stone-300 text-xl hover:text-stone-900 transition-colors">✕</button>
          </div>
          <div 
            ref={editorRef}
            contentEditable 
            dangerouslySetInnerHTML={{ __html: html }}
            className="p-10 min-h-[350px] focus:outline-none text-2xl leading-relaxed text-stone-800 overflow-y-auto bg-white"
          />
          <div className="p-6 border-t border-stone-50 flex justify-end bg-white">
            <button 
              onClick={handleSave}
              className="bg-stone-900 text-white px-10 py-4 rounded-full font-bold text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
            >
              Save Design
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      onClick={() => setIsEditing(true)} 
      className={`cursor-pointer hover:bg-stone-100/60 transition-all rounded-xl p-2 -m-2 ${className}`}
      dangerouslySetInnerHTML={{ __html: html || `<span class="text-stone-200 italic">點擊設計 ${label}</span>` }}
    />
  )
}

export default function TravelBuddies() {
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  // 智慧排序：剝除 HTML 標籤後進行日期比對，確保排序不崩潰
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
    } finally {
      setLoading(false) // 解決畫面卡死問題
    }
  }

  async function addJourney() {
    // 點擊新增按鈕
    const { data, error } = await supabase.from('honeymoon_itinerary').insert([{
      title: '<div>新地點</div>',
      date: '<div>2026.01.08</div>',
      time_slot: '<div>12:00</div>',
      guideline: '<div>溫馨提醒內容...</div>',
      thoughts: '<div>記錄此時的心情...</div>'
    }]).select()
    
    if (error) {
      alert("新增失敗，請確認已執行最新的 SQL 指令。")
    } else if (data) {
      setItinerary(sortList([...itinerary, data[0]]))
    }
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

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#fdfcfb]">
      <div className="w-10 h-10 border-2 border-stone-100 border-t-stone-800 rounded-full animate-spin mb-4"></div>
      <p className="font-serif text-stone-300 tracking-[0.4em] uppercase text-[10px]">Designing Journal...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#fdfcfb] text-stone-800 font-sans">
      
      {/* 1. 封面區 (標題垂直定位於左側藍色區域，縮小字級) */}
      <section className="h-screen w-full relative flex items-center justify-center overflow-hidden">
        <img src="https://bgvwsiqgbblgiggjlnfi.supabase.co/storage/v1/object/public/honeymoon-photos/cover.png" className="absolute inset-0 w-full h-full object-cover" alt="Cover" />
        <div className="absolute left-10 top-[40%] flex flex-col items-center gap-8 no-print print:left-8">
          <div className="h-20 w-[0.5px] bg-stone-400/40"></div>
          <h1 className="[writing-mode:vertical-lr] text-[10px] md:text-xs font-serif font-bold tracking-[0.6em] text-stone-800/60 rotate-180 uppercase">TRAVEL BUDDIES</h1>
          <div className="h-20 w-[0.5px] bg-stone-400/40"></div>
        </div>
      </section>

      {/* 2. 行程清單 - 滿版設計 */}
      <main className="w-full max-w-7xl mx-auto py-40 px-10 space-y-48">
        {itinerary.map((item, index) => (
          <section key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-20 items-start page-break">
            
            {/* 左側設計欄 (佔 5 格) */}
            <div className="md:col-span-5 md:sticky md:top-24 space-y-12">
              <div className="flex items-center gap-6">
                <span className="text-5xl font-serif italic text-stone-100">0{index + 1}</span>
                <div className="h-[1px] flex-1 bg-stone-50"></div>
              </div>

              {/* 全自由標題 */}
              <UniversalDesigner 
                label="地點標題" html={item.title} 
                onSave={(v) => handleUpdate(item.id, 'title', v)}
                className="text-5xl md:text-7xl font-serif font-bold text-stone-900 leading-tight tracking-tight block"
              />

              <div className="flex flex-col gap-4 font-mono text-[10px] text-stone-300 tracking-[0.3em] uppercase">
                <div className="flex gap-6 items-center">
                  <span>DATE</span>
                  <UniversalDesigner html={item.date} onSave={(v) => handleUpdate(item.id, 'date', v)} className="text-stone-900" />
                </div>
                <div className="flex gap-6 items-center">
                  <span>TIME</span>
                  <UniversalDesigner html={item.time_slot} onSave={(v) => handleUpdate(item.id, 'time_slot', v)} className="text-stone-900 font-bold" />
                </div>
              </div>

              {/* 溫馨提醒區域 */}
              <div className="bg-stone-50/50 p-12 rounded-[3.5rem] border border-stone-100">
                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-stone-200 mb-6 italic">溫馨提醒</p>
                <UniversalDesigner 
                  label="溫馨提醒" html={item.guideline} 
                  onSave={(v) => handleUpdate(item.id, 'guideline', v)}
                  className="text-lg leading-relaxed text-stone-600 italic"
                />
              </div>

              <div className="flex gap-4 no-print">
                <a href={item.google_maps_url} target="_blank" className="flex-1 text-center py-5 bg-stone-900 text-stone-50 rounded-full font-bold text-[9px] tracking-[0.3em] uppercase shadow-xl hover:bg-stone-800 transition-all">📍 Map</a>
                <label className="flex-1 text-center py-5 border border-stone-200 text-stone-800 rounded-full font-bold text-[9px] tracking-[0.3em] uppercase cursor-pointer hover:bg-white transition-all">
                  📷 Photo
                  <input type="file" accept="image/*" capture="camera" className="hidden" onChange={(e) => handleUpload(item.id, e.target.files?.[0], item.photo_urls)} />
                </label>
              </div>
            </div>

            {/* 右側展示欄 (佔 7 格) */}
            <div className="md:col-span-7 space-y-16">
              <div className="grid grid-cols-1 gap-12">
                {item.photo_urls?.length > 0 ? (
                  item.photo_urls.map((url, i) => <img key={i} src={url} className="w-full rounded-[3rem] shadow-sm hover:scale-[1.01] transition-all duration-500" />)
                ) : (
                  <div className="aspect-[4/3] bg-stone-50 rounded-[3.5rem] border border-dashed border-stone-100 flex items-center justify-center text-stone-200 font-serif italic text-sm">Waiting for memory...</div>
                )}
              </div>
              <div className="pt-12 border-t border-stone-100">
                <label className="text-[10px] font-black text-stone-200 uppercase tracking-[0.5em] mb-6 block italic">Personal Diary</label>
                <UniversalDesigner 
                  label="日誌" html={item.thoughts} 
                  onSave={(v) => handleUpdate(item.id, 'thoughts', v)}
                  className="min-h-[120px] text-2xl font-serif italic text-stone-500 leading-relaxed"
                />
              </div>
            </div>
          </section>
        ))}
      </main>

      {/* 3. 懸浮工具區 - 新增與 PDF */}
      <div className="fixed bottom-12 left-12 flex flex-col gap-5 no-print z-[200]">
        <button 
          onClick={addJourney} 
          className="w-16 h-16 bg-white border border-stone-200 rounded-full shadow-2xl flex items-center justify-center text-2xl hover:bg-stone-900 hover:text-white transition-all active:scale-90"
        >＋</button>
      </div>
      <div className="fixed bottom-12 right-12 no-print z-[200]">
        <button 
          onClick={() => window.print()} 
          className="w-16 h-16 bg-stone-900 text-stone-50 rounded-full shadow-2xl flex items-center justify-center font-bold text-[10px] tracking-widest active:scale-90"
        >PDF</button>
      </div>
    </div>
  )
}