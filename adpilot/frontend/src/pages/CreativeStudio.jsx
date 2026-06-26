import { useState, useEffect } from 'react'
import { Wand2, Image, Video, Copy, Trash2, CheckCircle, Download, Plus, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import { api } from '../api/client'

function CharCount({ text, max }) {
  const len = (text || '').length
  const color = len > max ? 'text-red-500' : len >= Math.floor(max * 0.9) ? 'text-amber-500' : 'text-gray-400'
  return <span className={`text-xs font-medium ${color}`}>{len}/{max}</span>
}

const TABS = [
  { id: 'copy', label: 'Ad Copy', icon: Copy },
  { id: 'image', label: 'Image Gen', icon: Image },
  { id: 'video', label: 'Video Gen', icon: Video },
  { id: 'library', label: 'Library', icon: Wand2 },
]

export default function CreativeStudio() {
  const [tab, setTab] = useState('copy')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copyWarning, setCopyWarning] = useState(null)
  const [creatives, setCreatives] = useState([])

  const [copyForm, setCopyForm] = useState({ product: '', audience: '', platform: 'meta', objective: 'sales', tone: 'professional', num_variants: 3 })
  const [copyResults, setCopyResults] = useState([])

  const [imageForm, setImageForm] = useState({ prompt: '', size: '1024x1024', quality: 'hd', style: 'vivid' })
  const [imageResults, setImageResults] = useState([])

  const [videoForm, setVideoForm] = useState({ prompt: '', duration: 5, ratio: '1280:720' })
  const [videoResult, setVideoResult] = useState(null)

  useEffect(() => {
    if (tab === 'library') loadCreatives()
  }, [tab])

  async function loadCreatives() {
    const data = await api.listCreatives()
    setCreatives(data)
  }

  async function handleGenerateCopy(e) {
    e.preventDefault()
    setLoading(true); setError(null); setCopyWarning(null); setCopyResults([])
    try {
      const res = await api.generateCopy(copyForm)
      setCopyResults(res.variants || [])
      if (res.warning) setCopyWarning(res.warning)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  async function handleGenerateImage(e) {
    e.preventDefault()
    setLoading(true); setError(null); setImageResults([])
    try {
      const res = await api.generateImage(imageForm)
      setImageResults(res.images || [])
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  async function handleGenerateVideo(e) {
    e.preventDefault()
    setLoading(true); setError(null); setVideoResult(null)
    try {
      const res = await api.generateVideo(videoForm)
      setVideoResult(res)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  async function handleDeleteCreative(id) {
    await api.deleteCreative(id)
    setCreatives((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {tab === 'copy' && (
        <div className="grid grid-cols-5 gap-6">
          <div className="col-span-2 card p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Generate Ad Copy</h3>
            <form onSubmit={handleGenerateCopy} className="space-y-4">
              <div>
                <label className="label">Product / Service</label>
                <input className="input" required placeholder="e.g. Premium running shoes for women" value={copyForm.product} onChange={(e) => setCopyForm(f => ({...f, product: e.target.value}))} />
              </div>
              <div>
                <label className="label">Target Audience</label>
                <input className="input" required placeholder="e.g. Women aged 25-40 who run 3+ times/week" value={copyForm.audience} onChange={(e) => setCopyForm(f => ({...f, audience: e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Platform</label>
                  <select className="input" value={copyForm.platform} onChange={(e) => setCopyForm(f => ({...f, platform: e.target.value}))}>
                    <option value="meta">Meta (FB/IG)</option>
                    <option value="google">Google Ads</option>
                  </select>
                </div>
                <div>
                  <label className="label">Objective</label>
                  <select className="input" value={copyForm.objective} onChange={(e) => setCopyForm(f => ({...f, objective: e.target.value}))}>
                    <option value="sales">Sales / Conversions</option>
                    <option value="leads">Lead Generation</option>
                    <option value="awareness">Brand Awareness</option>
                    <option value="traffic">Website Traffic</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tone</label>
                  <select className="input" value={copyForm.tone} onChange={(e) => setCopyForm(f => ({...f, tone: e.target.value}))}>
                    <option value="professional">Professional</option>
                    <option value="casual">Casual & Friendly</option>
                    <option value="urgent">Urgent & Exciting</option>
                    <option value="playful">Playful & Fun</option>
                    <option value="luxurious">Luxurious</option>
                  </select>
                </div>
                <div>
                  <label className="label">{copyForm.platform === 'google' ? 'RSA Sets' : 'Variants'}</label>
                  <select className="input" value={copyForm.num_variants} onChange={(e) => setCopyForm(f => ({...f, num_variants: parseInt(e.target.value)}))}>
                    {copyForm.platform === 'google'
                      ? [1, 2, 3].map(n => <option key={n} value={n}>{n} set{n > 1 ? 's' : ''} · {n * 15} headlines + {n * 4} descriptions</option>)
                      : [1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)
                    }
                  </select>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                <Wand2 size={16} />
                {loading ? 'Generating...' : 'Generate Copy'}
              </button>
            </form>
          </div>

          <div className="col-span-3 space-y-4">
            {copyWarning && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-500" />
                <span>{copyWarning} — Showing template-based copy. <a href="/settings" className="underline font-medium">Add AI credits in Settings</a> for Claude-generated variants.</span>
              </div>
            )}
            {copyResults.length === 0 && !loading && (
              <div className="card p-8 text-center text-gray-400">
                <Copy size={32} className="mx-auto mb-3 opacity-30" />
                <p>Fill in the form and click Generate Copy</p>
              </div>
            )}
            {copyResults.map((v, i) =>
              v.type === 'google_rsa' ? (
                <div key={i} className="card p-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">Google RSA · Set {i + 1}</span>
                      <span className="text-xs text-gray-400">Google picks the best combinations automatically</span>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(v.headlines.join('\n') + '\n\n' + v.descriptions.join('\n'))}
                      className="btn-secondary text-xs py-1"
                    >
                      Copy All
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-700">Headlines <span className="text-gray-400 font-normal">({v.headlines.length}/15)</span></p>
                      <p className="text-xs text-gray-400">Max 30 chars each</p>
                    </div>
                    <div className="space-y-1.5">
                      {v.headlines.map((h, j) => {
                        const len = h.length
                        const color = len > 30 ? 'text-red-500' : len >= 27 ? 'text-amber-500' : 'text-gray-400'
                        return (
                          <div key={j} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-xs text-gray-400 w-5 shrink-0">{j + 1}</span>
                            <span className="text-sm text-gray-900 flex-1">{h}</span>
                            <span className={`text-xs font-medium shrink-0 ${color}`}>{len}/30</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-700">Descriptions <span className="text-gray-400 font-normal">({v.descriptions.length}/4)</span></p>
                      <p className="text-xs text-gray-400">Max 90 chars each</p>
                    </div>
                    <div className="space-y-1.5">
                      {v.descriptions.map((d, j) => {
                        const len = d.length
                        const color = len > 90 ? 'text-red-500' : len >= 81 ? 'text-amber-500' : 'text-gray-400'
                        return (
                          <div key={j} className="bg-gray-50 rounded-lg px-3 py-2">
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-gray-400 w-5 shrink-0 mt-0.5">{j + 1}</span>
                              <span className="text-sm text-gray-700 flex-1 leading-relaxed">{d}</span>
                              <span className={`text-xs font-medium shrink-0 mt-0.5 ${color}`}>{len}/90</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div key={i} className="card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">Variant {i + 1}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(`${v.headline}\n\n${v.primary_text || v.content}\n\n${v.description}`)}
                      className="btn-secondary text-xs py-1"
                    >
                      Copy All
                    </button>
                  </div>
                  {v.hook && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Hook</p>
                      <p className="text-sm font-semibold text-gray-900">{v.hook}</p>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-gray-400">Headline</p>
                      <CharCount text={v.headline} max={40} />
                    </div>
                    <p className="text-sm font-bold text-gray-900">{v.headline}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-gray-400">Primary Text</p>
                      <CharCount text={v.primary_text || v.content} max={125} />
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{v.primary_text || v.content}</p>
                  </div>
                  <div className="flex items-start justify-between pt-2 border-t border-gray-50 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs text-gray-400">Description</p>
                        <CharCount text={v.description} max={30} />
                      </div>
                      <p className="text-sm text-gray-600 truncate">{v.description}</p>
                    </div>
                    <span className="text-xs font-bold text-white bg-blue-600 px-3 py-1 rounded-full shrink-0">{v.cta}</span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {tab === 'image' && (
        <div className="grid grid-cols-5 gap-6">
          <div className="col-span-2 card p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Generate Ad Image</h3>
            <form onSubmit={handleGenerateImage} className="space-y-4">
              <div>
                <label className="label">Image Prompt</label>
                <textarea className="input resize-none" rows={5} required placeholder="Describe the ad image in detail. E.g. A woman running in a park at sunrise wearing bright blue athletic shoes, energetic and motivating atmosphere..." value={imageForm.prompt} onChange={(e) => setImageForm(f => ({...f, prompt: e.target.value}))} />
              </div>
              <div>
                <label className="label">Size / Format</label>
                <select className="input" value={imageForm.size} onChange={(e) => setImageForm(f => ({...f, size: e.target.value}))}>
                  <option value="1024x1024">Square 1:1 — Instagram Feed</option>
                  <option value="1792x1024">Landscape 16:9 — Facebook/YouTube</option>
                  <option value="1024x1792">Portrait 9:16 — Stories/Reels</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Quality</label>
                  <select className="input" value={imageForm.quality} onChange={(e) => setImageForm(f => ({...f, quality: e.target.value}))}>
                    <option value="hd">HD (Recommended)</option>
                    <option value="standard">Standard (Faster)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Style</label>
                  <select className="input" value={imageForm.style} onChange={(e) => setImageForm(f => ({...f, style: e.target.value}))}>
                    <option value="vivid">Vivid</option>
                    <option value="natural">Natural</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                <Image size={16} />
                {loading ? 'Generating (10-30s)...' : 'Generate Image'}
              </button>
            </form>
          </div>

          <div className="col-span-3 space-y-4">
            {imageResults.length === 0 && !loading && (
              <div className="card p-8 text-center text-gray-400">
                <Image size={32} className="mx-auto mb-3 opacity-30" />
                <p>Generated images will appear here</p>
              </div>
            )}
            {loading && (
              <div className="card p-8 text-center">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Generating with DALL-E 3... this takes ~15 seconds</p>
              </div>
            )}
            {imageResults.map((img, i) => (
              <div key={i} className="card overflow-hidden">
                <img src={img.content} alt="Generated ad" className="w-full object-contain max-h-96" />
                <div className="p-4">
                  <p className="text-xs text-gray-400 leading-relaxed">{img.revised_prompt?.slice(0, 150)}...</p>
                  <div className="flex gap-2 mt-3">
                    <a href={img.content} target="_blank" rel="noreferrer" className="btn-secondary text-xs py-1.5">Open Full Size</a>
                    <button onClick={() => navigator.clipboard.writeText(img.content)} className="btn-secondary text-xs py-1.5">Copy URL</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'video' && (
        <div className="grid grid-cols-5 gap-6">
          <div className="col-span-2 card p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Generate Ad Video</h3>
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <p className="text-xs text-amber-700">Powered by Runway Gen-3 Alpha. Requires Runway API key in Settings. Generation takes 1-2 minutes.</p>
            </div>
            <form onSubmit={handleGenerateVideo} className="space-y-4">
              <div>
                <label className="label">Video Concept</label>
                <textarea className="input resize-none" rows={5} required placeholder="Describe the video ad. E.g. A dynamic product showcase of running shoes, close-up of shoes hitting the pavement, slow motion splashes, energetic music vibe..." value={videoForm.prompt} onChange={(e) => setVideoForm(f => ({...f, prompt: e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Duration</label>
                  <select className="input" value={videoForm.duration} onChange={(e) => setVideoForm(f => ({...f, duration: parseInt(e.target.value)}))}>
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                  </select>
                </div>
                <div>
                  <label className="label">Format</label>
                  <select className="input" value={videoForm.ratio} onChange={(e) => setVideoForm(f => ({...f, ratio: e.target.value}))}>
                    <option value="1280:720">Landscape 16:9</option>
                    <option value="720:1280">Portrait 9:16</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                <Video size={16} />
                {loading ? 'Generating (60-120s)...' : 'Generate Video'}
              </button>
            </form>
          </div>

          <div className="col-span-3">
            {!videoResult && !loading && (
              <div className="card p-8 text-center text-gray-400">
                <Video size={32} className="mx-auto mb-3 opacity-30" />
                <p>Generated video will appear here</p>
              </div>
            )}
            {loading && (
              <div className="card p-12 text-center">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-700 font-medium">Generating video with Runway Gen-3...</p>
                <p className="text-gray-400 text-sm mt-1">This usually takes 60-120 seconds</p>
              </div>
            )}
            {videoResult && (
              <div className="card overflow-hidden">
                <video controls className="w-full" src={videoResult.content}>
                  Your browser does not support video.
                </video>
                <div className="p-4 flex gap-2">
                  <a href={videoResult.content} target="_blank" rel="noreferrer" className="btn-primary text-sm">View Full Video</a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'library' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Creative Library ({creatives.length})</h3>
            <button onClick={() => setTab('copy')} className="btn-primary text-sm">
              <Plus size={15} /> Create New
            </button>
          </div>
          {creatives.length === 0 ? (
            <div className="card p-10 text-center text-gray-400">
              <Wand2 size={32} className="mx-auto mb-3 opacity-30" />
              <p>No creatives generated yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {creatives.map((c) => (
                <div key={c.id} className="card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-600 capitalize">{c.type}</span>
                    <button onClick={() => handleDeleteCreative(c.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {c.type === 'image' && <img src={c.content} alt="" className="w-full h-40 object-cover rounded-lg" />}
                  {c.type === 'video' && <video src={c.content} className="w-full h-40 object-cover rounded-lg" controls />}
                  {c.type === 'copy' && (() => {
                    let rsa = null
                    try { const p = JSON.parse(c.content); if (p.type === 'google_rsa' || p.type === 'search_rsa') rsa = p } catch {}
                    if (rsa) return (
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">Google RSA</span>
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Headlines ({rsa.headlines.length}/15)</p>
                          {rsa.headlines.slice(0, 3).map((h, i) => (
                            <p key={i} className="text-xs font-medium text-blue-700 truncate">{h}</p>
                          ))}
                          {rsa.headlines.length > 3 && <p className="text-xs text-gray-400">+{rsa.headlines.length - 3} more</p>}
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Descriptions ({rsa.descriptions.length}/4)</p>
                          {rsa.descriptions.slice(0, 1).map((d, i) => (
                            <p key={i} className="text-xs text-gray-600 line-clamp-2">{d}</p>
                          ))}
                        </div>
                      </div>
                    )
                    return (
                      <div className="space-y-1">
                        {c.platform === 'meta' && <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Meta Ad</span>}
                        {c.headline && <p className="font-semibold text-sm text-gray-900">{c.headline}</p>}
                        <p className="text-xs text-gray-500 line-clamp-3">{c.content}</p>
                        {c.cta && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{c.cta}</span>}
                      </div>
                    )
                  })()}
                  <p className="text-xs text-gray-300">{new Date(c.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
