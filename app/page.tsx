'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { toPng } from 'html-to-image'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

// --- 資料型別 ---
interface ItineraryItem {
  id: string; day_number: number; date: string; time_slot: string; title: string;
  guideline: string; photo_urls: string[]; thoughts: string; google_maps_url: string;
  template?: string; // 模板類型：'classic' 或 'minimal'
}

// --- 【照片智能布局助手】根據照片數量返回布局方式 ---
function getPhotoLayout(photoCount: number): {
  gridCols: string;
  maxPhotos: number;
  layout: 'single' | 'dual' | 'one-large-two-small' | 'grid-2x2';
} {
  if (photoCount === 0) return { gridCols: 'grid-cols-1', maxPhotos: 0, layout: 'single' };
  if (photoCount === 1) return { gridCols: 'grid-cols-1', maxPhotos: 1, layout: 'single' };
  if (photoCount === 2) return { gridCols: 'grid-cols-2', maxPhotos: 2, layout: 'dual' };
  if (photoCount === 3) return { gridCols: 'grid-cols-2', maxPhotos: 3, layout: 'one-large-two-small' };
  return { gridCols: 'grid-cols-2', maxPhotos: 4, layout: 'grid-2x2' };
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

// --- 【2. 極簡模板渲染器】根據照片數量智能排版 ---
function MinimalTemplate({ item, pageNum, onUpdate }: { item: ItineraryItem, pageNum: number, onUpdate: (field: keyof ItineraryItem, value: any) => void }) {
  const photoCount = item.photo_urls?.length || 0
  const layout = getPhotoLayout(photoCount)
  const photos = item.photo_urls?.slice(0, layout.maxPhotos) || []
  
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white/20">
      {/* 極簡頁面標籤 */}
      <div className="p-6 flex-shrink-0">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
          Day {pageNum} | <UniversalDesigner html={item.date} onSave={(v) => onUpdate('date', v)} className="inline" />
        </div>
      </div>
      
      {/* 內容區 - 極簡排版 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-8 pb-8 space-y-12 touch-pan-y">
        {/* 大標題區 */}
        <div className="text-center space-y-4">
          <UniversalDesigner 
            label="標題" 
            html={item.title} 
            onSave={(v) => onUpdate('title', v)} 
            className="text-4xl md:text-6xl font-serif font-bold leading-tight text-stone-900" 
          />
          <UniversalDesigner 
            label="副標題" 
            html={item.guideline} 
            onSave={(v) => onUpdate('guideline', v)} 
            className="text-lg text-stone-600 leading-relaxed max-w-md mx-auto" 
          />
        </div>
        
        {/* 照片區 - 智能布局 */}
        {photoCount > 0 && (
          <div className={`grid ${layout.gridCols} gap-4`}>
            {layout.layout === 'one-large-two-small' ? (
              <>
                <div className="col-span-2">
                  <img src={photos[0]} className="w-full h-96 object-cover rounded-2xl shadow-lg" alt="Photo 1" />
                </div>
                {photos[1] && <img src={photos[1]} className="w-full h-48 object-cover rounded-2xl shadow-lg" alt="Photo 2" />}
                {photos[2] && <img src={photos[2]} className="w-full h-48 object-cover rounded-2xl shadow-lg" alt="Photo 3" />}
              </>
            ) : (
              photos.map((url, i) => (
                <img 
                  key={i} 
                  src={url} 
                  className={`w-full ${layout.layout === 'single' ? 'h-96' : 'h-64'} object-cover rounded-2xl shadow-lg`} 
                  alt={`Photo ${i + 1}`} 
                />
              ))
            )}
          </div>
        )}
        
        {/* 文字描述區 */}
        <div className="text-center max-w-lg mx-auto">
          <UniversalDesigner 
            label="日誌" 
            html={item.thoughts} 
            className="text-xl font-serif italic text-stone-700 leading-relaxed" 
            onSave={(v) => onUpdate('thoughts', v)} 
          />
        </div>
        
        {/* 底部留白 */}
        <div className="h-24"></div>
      </div>
    </div>
  )
}

export default function TravelBuddies() {
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState('')
  const [bgColor, setBgColor] = useState('#ffd9b6')
  const [currentPage, setCurrentPage] = useState(0)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data, error } = await supabase.from('honeymoon_itinerary').select('*')
    if (error) {
      console.error('❌ 獲取數據錯誤:', error)
      alert('無法加載數據: ' + error.message)
    }
    if (data) setItinerary(data.sort((a, b) => {
        const clean = (s: string) => s ? s.replace(/<[^>]*>/g, '').trim() : ""
        return new Date(clean(a.date)).getTime() - new Date(clean(b.date)).getTime()
    }))
    setLoading(false)
  }

  async function handleUpdate(id: string, field: keyof ItineraryItem, value: any) {
    const updated = itinerary.map(item => item.id === id ? { ...item, [field]: value } : item)
    setItinerary(updated)
    const { error } = await supabase.from('honeymoon_itinerary').update({ [field]: value }).eq('id', id)
    if (error) {
      console.error('❌ 更新數據錯誤:', error)
      alert('更新失敗: ' + error.message)
    }
  }

  // --- 【功能升級：多圖上傳 + 錯誤處理】 ---
  async function handleBatchUpload(id: string, files: FileList | null, currentPhotos: string[]) {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    console.log(`📸 開始上傳 ${files.length} 張照片...`);
    
    try {
      const uploadedUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const timestamp = Date.now();
        const path = `uploads/${id}-${timestamp}-${i}-${file.name}`;
        
        console.log(`⬆️ 上傳第 ${i + 1}/${files.length} 張: ${file.name}`);
        
        const { data, error: uploadError } = await supabase.storage
          .from('honeymoon-photos')
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false
          });
        
        if (uploadError) {
          console.error(`❌ 上傳失敗 (${file.name}):`, uploadError);
          throw uploadError;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('honeymoon-photos')
          .getPublicUrl(path);
        
        uploadedUrls.push(publicUrl);
        console.log(`✅ 上傳成功: ${publicUrl}`);
      }
      
      const newPhotos = [...(currentPhotos || []), ...uploadedUrls];
      console.log(`💾 更新數據庫，總共 ${newPhotos.length} 張照片`);
      
      const { error: updateError } = await supabase
        .from('honeymoon_itinerary')
        .update({ photo_urls: newPhotos })
        .eq('id', id);
      
      if (updateError) {
        console.error('❌ 數據庫更新錯誤:', updateError);
        throw updateError;
      }
      
      // 更新本地狀態
      const updated = itinerary.map(item => 
        item.id === id ? { ...item, photo_urls: newPhotos } : item
      );
      setItinerary(updated);
      
      console.log('🎉 上傳完成！');
      alert(`✅ 成功上傳 ${uploadedUrls.length} 張照片！`);
      
    } catch (error: any) {
      console.error('❌ 上傳過程出錯:', error);
      alert('上傳失敗: ' + (error.message || '未知錯誤'));
    } finally {
      setUploading(false);
    }
  }

  async function addJourney() {
    const { data } = await supabase.from('honeymoon_itinerary').insert([{ title: '<div>New Day</div>', photo_urls: [] }]).select()
    if (data) {
        setItinerary([...itinerary, data[0]])
        setCurrentPage(itinerary.length + 1)
    }
  }

  // --- 【導出為 Canva 素材包】3x 高清圖片 + JSON 數據 + ZIP 打包 ---
  async function exportToCanva() {
    if (exporting) return;
    
    setExporting(true);
    setExportProgress('準備導出...');
    console.log('📦 開始導出 Canva 素材包...');
    
    try {
      const zip = new JSZip();
      const imagesFolder = zip.folder('images');
      
      if (!imagesFolder) {
        throw new Error('無法創建圖片文件夾');
      }
      
      // 準備導出數據
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        backgroundColor: bgColor,
        pages: [] as any[]
      };
      
      // 創建臨時渲染容器
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '-10000px';
      container.style.left = '-10000px';
      container.style.width = '550px';
      container.style.aspectRatio = '1/1.41';
      document.body.appendChild(container);
      
      // 遍歷所有頁面並渲染為圖片
      for (let idx = 0; idx < allPages.length; idx++) {
        const page = allPages[idx];
        const pageNum = idx.toString().padStart(2, '0');
        
        setExportProgress(`正在渲染第 ${idx + 1}/${allPages.length} 頁...`);
        console.log(`🎨 渲染第 ${idx + 1}/${allPages.length} 頁: ${page.type}`);
        
        // 創建頁面元素
        container.innerHTML = '';
        const pageElement = document.createElement('div');
        pageElement.style.width = '100%';
        pageElement.style.height = '100%';
        pageElement.style.backgroundColor = bgColor;
        pageElement.style.borderRadius = '3rem';
        pageElement.style.overflow = 'hidden';
        pageElement.style.position = 'relative';
        
        if (page.type === 'cover') {
          // 封面頁
          pageElement.innerHTML = `
            <div style="position: absolute; inset: 0; overflow: hidden; border-radius: 3rem;">
              <img src="https://bgvwsiqgbblgiggjlnfi.supabase.co/storage/v1/object/public/honeymoon-photos/cover.png" 
                   style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;"
                   crossorigin="anonymous" />
            </div>
          `;
          
          exportData.pages.push({
            pageNumber: idx,
            type: 'cover',
            imageFile: `images/cover.png`
          });
        } else {
          // 行程內容頁
          const item = page as any;
          pageElement.innerHTML = `
            <div style="padding: 3rem; height: 100%; display: flex; flex-direction: column; gap: 2rem; overflow: hidden;">
              <div style="display: flex; align-items: center; gap: 1rem;">
                <span style="font-size: 2rem; font-family: serif; font-style: italic; color: rgba(120, 113, 108, 0.8);">0${idx}</span>
                <div style="height: 1px; flex: 1; background: rgba(214, 211, 209, 0.5);"></div>
              </div>
              
              <div style="font-size: 2.5rem; font-family: serif; font-weight: bold; line-height: 1.2; color: #1c1917;">
                ${item.title || ''}
              </div>
              
              <div style="background: rgba(255, 255, 255, 0.6); padding: 1.5rem; border-radius: 2rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border: 1px solid rgba(231, 229, 228, 0.5);">
                <div style="font-size: 1rem; color: #57534e; line-height: 1.6;">
                  ${item.guideline || ''}
                </div>
              </div>
              
              ${item.photo_urls && item.photo_urls.length > 0 ? `
                <div style="display: grid; grid-template-columns: 1fr; gap: 1.25rem;">
                  ${item.photo_urls.slice(0, 2).map((url: string) => `
                    <img src="${url}" 
                         style="width: 100%; border-radius: 2rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border: 8px solid white; object-fit: cover; max-height: 300px;"
                         crossorigin="anonymous" />
                  `).join('')}
                </div>
              ` : ''}
              
              <div style="background: rgba(250, 250, 249, 0.5); padding: 1.5rem; border-radius: 2rem;">
                <div style="font-size: 1.25rem; font-family: serif; font-style: italic; color: #57534e; line-height: 1.6;">
                  ${item.thoughts || ''}
                </div>
              </div>
            </div>
          `;
          
          exportData.pages.push({
            pageNumber: idx,
            type: 'itinerary',
            imageFile: `images/page-${pageNum}.png`,
            data: {
              id: item.id,
              dayNumber: item.day_number,
              date: item.date,
              title: item.title,
              guideline: item.guideline,
              thoughts: item.thoughts,
              photoUrls: item.photo_urls,
              googleMapsUrl: item.google_maps_url
            }
          });
        }
        
        container.appendChild(pageElement);
        
        // 等待圖片加載
        const images = pageElement.querySelectorAll('img');
        await Promise.all(
          Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              // 設置超時
              setTimeout(() => resolve(null), 5000);
            });
          })
        );
        
        // 短暫延遲確保渲染完成
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 將頁面轉換為高清圖片（3x 分辨率）
        try {
          const dataUrl = await toPng(pageElement, {
            pixelRatio: 3,
            quality: 1.0,
            backgroundColor: bgColor,
            cacheBust: true
          });
          
          // 將 base64 轉換為 binary
          const base64Data = dataUrl.split(',')[1];
          const binaryData = atob(base64Data);
          const arrayBuffer = new Uint8Array(binaryData.length);
          for (let i = 0; i < binaryData.length; i++) {
            arrayBuffer[i] = binaryData.charCodeAt(i);
          }
          
          // 添加到 ZIP
          const filename = page.type === 'cover' ? 'cover.png' : `page-${pageNum}.png`;
          imagesFolder.file(filename, arrayBuffer, { binary: true });
          
          console.log(`✅ 第 ${idx + 1} 頁渲染完成: ${filename}`);
        } catch (err) {
          console.error(`❌ 渲染第 ${idx + 1} 頁失敗:`, err);
          throw err;
        }
      }
      
      // 清理臨時容器
      document.body.removeChild(container);
      
      setExportProgress('正在打包文件...');
      
      // 添加 JSON 數據文件
      zip.file('data.json', JSON.stringify(exportData, null, 2));
      
      // 添加 manifest 元數據
      const manifest = {
        name: 'Travel Buddies Export',
        version: '1.0',
        exportDate: new Date().toISOString(),
        totalPages: allPages.length,
        backgroundColor: bgColor
      };
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      
      // 添加使用說明
      const readme = `Travel Buddies - Canva 素材包

📦 內容說明：
- images/ 文件夾包含所有頁面的高清圖片（3x 分辨率）
- data.json 包含完整的行程數據和富文本內容
- manifest.json 包含導出元數據

🎨 如何在 Canva 中使用：
1. 將 images 文件夾中的圖片直接拖入 Canva
2. 使用 data.json 中的文本內容進行編輯
3. 圖片已經是高清格式，可以直接使用

導出時間：${new Date().toLocaleString('zh-CN')}
背景顏色：${bgColor}
總頁數：${allPages.length}
`;
      zip.file('README.txt', readme);
      
      // 生成 ZIP 文件並下載
      setExportProgress('正在生成 ZIP 文件...');
      console.log('🗜️ 生成 ZIP 文件...');
      
      const blob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      });
      
      const filename = `travel-buddies-${new Date().toISOString().split('T')[0]}.zip`;
      saveAs(blob, filename);
      
      console.log('🎉 導出完成！');
      alert(`✅ 導出成功！\n\n文件名：${filename}\n包含：${allPages.length} 頁高清圖片 + JSON 數據`);
      
    } catch (error: any) {
      console.error('❌ 導出失敗:', error);
      alert(`導出失敗：${error.message || '未知錯誤'}`);
    } finally {
      setExporting(false);
      setExportProgress('');
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
          @page { 
            size: A4; 
            margin: 0; 
          }
          body, html { 
            background: none !important;
            margin: 0;
            padding: 0;
          }
          .no-print { 
            display: none !important; 
          }
          .print-container { 
            display: block !important; 
          }
          .print-page { 
            width: 210mm !important; 
            height: 297mm !important; 
            background-color: ${bgColor} !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            padding: 20mm;
            display: flex !important; 
            flex-direction: column !important;
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
          }
          .print-page:last-child {
            page-break-after: auto !important;
          }
        }
      `}</style>

      {/* 模板切換按鈕 - 僅非封面頁顯示 */}
      {allPages[currentPage].type !== 'cover' && (
        <div className="fixed top-8 right-8 z-[300] no-print">
          <button
            onClick={() => {
              const currentTemplate = (allPages[currentPage] as any).template || 'classic';
              const newTemplate = currentTemplate === 'classic' ? 'minimal' : 'classic';
              handleUpdate((allPages[currentPage] as any).id, 'template', newTemplate);
            }}
            className="bg-white/90 backdrop-blur-md rounded-full px-6 py-3 shadow-2xl flex items-center gap-2 hover:bg-white transition-colors"
          >
            <span className="text-2xl">{(allPages[currentPage] as any).template === 'minimal' ? '📖' : '✨'}</span>
            <span className="text-[10px] font-black tracking-widest uppercase">
              {(allPages[currentPage] as any).template === 'minimal' ? '經典' : '極簡'}
            </span>
          </button>
        </div>
      )}

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
              // 【封面：Full 版 - 純圖片，無標題】
              <div className="absolute inset-0 overflow-hidden rounded-[3rem]">
                 <img src="https://bgvwsiqgbblgiggjlnfi.supabase.co/storage/v1/object/public/honeymoon-photos/cover.png" className="absolute inset-0 w-full h-full object-cover" />
              </div>
            ) : (
              // 【行程內容頁 - 根據模板類型渲染】
              (allPages[currentPage] as any).template === 'minimal' ? (
                <MinimalTemplate 
                  item={allPages[currentPage] as any} 
                  pageNum={currentPage}
                  onUpdate={(field, value) => handleUpdate((allPages[currentPage] as any).id, field, value)}
                />
              ) : (
              // 【經典模板 - 原有排版】
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="p-8 pb-0 flex items-center gap-4 flex-shrink-0">
                  <span className="text-3xl font-serif italic text-stone-400/80">0{currentPage}</span>
                  <div className="h-[1px] flex-1 bg-stone-300/50" />
                </div>
                
                {/* 內容捲動區：只有這個區域可以滾動，背景固定 */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 pt-6 space-y-8 touch-pan-y">
                   <UniversalDesigner 
                     label="標題" 
                     html={(allPages[currentPage] as any).title} 
                     onSave={(v) => handleUpdate((allPages[currentPage] as any).id, 'title', v)} 
                     className="text-3xl md:text-5xl font-serif font-bold leading-tight text-stone-800 mb-2" 
                   />
                   
                   <div className="bg-white/60 p-6 rounded-[2rem] shadow-sm border border-stone-200/50">
                     <UniversalDesigner 
                       label="提醒" 
                       html={(allPages[currentPage] as any).guideline} 
                       onSave={(v) => handleUpdate((allPages[currentPage] as any).id, 'guideline', v)} 
                       className="text-base text-stone-600 leading-relaxed" 
                     />
                   </div>
                   
                   <div className="grid grid-cols-1 gap-5">
                      {(allPages[currentPage] as any).photo_urls?.map((url: string, i: number) => (
                        <div key={i} className="relative">
                          <img src={url} className="w-full rounded-[2rem] shadow-lg border-[8px] border-white object-cover" alt={`Photo ${i + 1}`} />
                        </div>
                      ))}
                   </div>
                   
                   <div className="bg-stone-50/50 p-6 rounded-[2rem]">
                     <UniversalDesigner 
                       label="日誌" 
                       html={(allPages[currentPage] as any).thoughts} 
                       className="text-lg md:text-xl font-serif italic text-stone-600 leading-relaxed" 
                       onSave={(v) => handleUpdate((allPages[currentPage] as any).id, 'thoughts', v)} 
                     />
                   </div>
                   
                   {/* 底部留白，確保內容不會被按鈕遮擋 */}
                   <div className="h-24"></div>
                </div>

                {/* 底部功能區 - 固定在底部 */}
                <div className="p-6 border-t border-white/20 bg-white/10 backdrop-blur-md flex gap-4 no-print flex-shrink-0">
                   <label className={`flex-1 text-center py-4 rounded-full text-[10px] font-bold tracking-widest shadow-xl transition-colors ${
                     uploading 
                       ? 'bg-stone-400 text-white cursor-not-allowed' 
                       : 'bg-stone-900 text-white cursor-pointer hover:bg-stone-800'
                   }`}>
                      {uploading ? '⏳ 上傳中...' : '📷 上傳照片'}
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        className="hidden" 
                        disabled={uploading}
                        onChange={(e) => handleBatchUpload((allPages[currentPage] as any).id, e.target.files, (allPages[currentPage] as any).photo_urls)} 
                      />
                   </label>
                </div>
              </div>
              )
            )}
            <div className="absolute bottom-6 left-0 right-0 text-center font-serif text-[10px] text-stone-300 no-print">PAGE {currentPage + 1} / {allPages.length}</div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 【一鍵成書：隱藏列印容器】渲染全部頁面供 PDF 使用 */}
      <div className="hidden print-container" style={{display: 'none'}}>
        {allPages.map((page, idx) => (
          <div key={`print-${idx}`} className="print-page">
            {page.type === 'cover' ? (
              <div className="flex-1 relative" style={{margin: '-20mm', width: '210mm', height: '297mm'}}>
                 <img 
                   src="https://bgvwsiqgbblgiggjlnfi.supabase.co/storage/v1/object/public/honeymoon-photos/cover.png" 
                   className="w-full h-full object-cover" 
                   style={{width: '210mm', height: '297mm'}}
                   alt="Cover" 
                 />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="text-5xl font-serif italic text-stone-400/80">0{idx}</div>
                  <div className="h-[1px] flex-1 bg-stone-300/50" />
                </div>
                <div className="text-4xl font-serif font-bold leading-tight mb-6" dangerouslySetInnerHTML={{ __html: (page as any).title }} />
                <div className="bg-white/40 p-8 rounded-[2rem] text-xl leading-relaxed mb-6" dangerouslySetInnerHTML={{ __html: (page as any).guideline }} />
                <div className="grid grid-cols-1 gap-5">
                  {(page as any).photo_urls?.map((url: string, i: number) => (
                    <img key={i} src={url} className="w-full rounded-[2rem] border-[8px] border-white object-cover" style={{maxHeight: '400px'}} />
                  ))}
                </div>
                <div className="text-2xl font-serif italic text-stone-600 leading-relaxed mt-6" dangerouslySetInnerHTML={{ __html: (page as any).thoughts }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 導出進度提示 */}
      {exporting && (
        <div className="fixed inset-0 z-[700] bg-stone-900/80 backdrop-blur-lg flex items-center justify-center no-print">
          <div className="bg-white rounded-[3rem] p-12 shadow-2xl max-w-md w-full mx-4 text-center">
            <div className="text-6xl mb-6">📦</div>
            <div className="text-2xl font-bold text-stone-800 mb-4">正在導出素材包</div>
            <div className="text-lg text-stone-600 mb-8">{exportProgress}</div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 bg-stone-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
              <div className="w-3 h-3 bg-stone-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
              <div className="w-3 h-3 bg-stone-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
            </div>
          </div>
        </div>
      )}

      {/* 底部工具 */}
      <div className="fixed bottom-8 right-8 flex items-center gap-5 no-print z-[300]">
        <button onClick={addJourney} className="w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-3xl">+</button>
        <div className="bg-white/90 backdrop-blur-md rounded-full px-6 py-4 shadow-2xl flex items-center gap-4">
           <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-8 h-8 rounded-full cursor-pointer bg-transparent border-none" />
           <button 
             onClick={exportToCanva}
             disabled={exporting}
             className={`text-[10px] font-black tracking-widest uppercase ${
               exporting ? 'text-stone-400 cursor-not-allowed' : 'text-stone-900 hover:text-stone-600'
             }`}
           >
             📦 導出素材
           </button>
           <div className="w-[1px] h-6 bg-stone-300" />
           <button onClick={() => window.print()} className="text-[10px] font-black tracking-widest uppercase">一鍵成書 (PDF)</button>
        </div>
      </div>
    </div>
  )
}
