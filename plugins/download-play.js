import axios from "axios"
import yts from "yt-search"
import fs from "fs"
import path from "path"
import { promisify } from "util"
import { pipeline } from "stream"

const streamPipe = promisify(pipeline)
const MAX_FILE_SIZE = 60 * 1024 * 1024

const handler = async (msg, { conn, text }) => {
  if (!text || !text.trim()) {
    return conn.sendMessage(
      msg.key.remoteJid,
      { text: "🎵 Ingresa el nombre de un video para buscar" },
      { quoted: msg }
    )
  }

  await conn.sendMessage(msg.key.remoteJid, {
    react: { text: "🕒", key: msg.key }
  })

  const searchQuery = text.trim()
  const posibles = ["128kbps", "128kbps", "128kbps"]

  let audioDownloadUrl = null
  let calidadElegida = "Desconocida"
  let apiUsada = "Desconocida"

  const tryDownload = async () => {
    let winner = null
    let intentos = 0

    while (!winner && intentos < 2) {
      intentos++
      try {
        const res = await yts(searchQuery)
        const video = res.videos[0]
        if (!video) throw new Error("❌ No se encontró ningún resultado.")

        const videoUrl = video.url

        const tryApi = (apiName, urlBuilder) => new Promise(async (resolve, reject) => {
          const controller = new AbortController()
          try {
            for (const q of posibles) {
              const apiUrl = urlBuilder(q)
              const r = await axios.get(apiUrl, { timeout: 15000, signal: controller.signal })
              if (r.data?.status && (r.data?.result?.url || r.data?.data?.url)) {
                resolve({
                  url: r.data.result?.url || r.data.data?.url,
                  quality: r.data.result?.quality || r.data.data?.quality || q,
                  api: apiName,
                  controller
                })
                return
              }
            }
            reject(new Error(`${apiName}: No entregó un URL válido`))
          } catch (err) {
            if (!err.message.toLowerCase().includes("aborted")) reject(new Error(`${apiName}: ${err.message}`))
          }
        })

        const mayApi = tryApi("MayAPI", q =>
          `https://mayapi.ooguy.com/ytdl?url=${encodeURIComponent(videoUrl)}&type=audio&quality=128kbps&apikey=may-0595dca2`
        )
        const neoxApi = tryApi("NeoxR", q =>
          `https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(videoUrl)}&type=audio&quality=128kbps&apikey=russellxz`
        )
        const adonixApi = tryApi("AdonixAPI", q =>
          `https://api-adonix.ultraplus.click/download/ytmp3?apikey=AdonixKeyz11c2f6197&url=${encodeURIComponent(videoUrl)}`
        )

        winner = await Promise.any([mayApi, neoxApi, adonixApi])
        ;[mayApi, neoxApi, adonixApi].forEach(p => { if (p !== winner && p.controller) p.controller.abort() })
      } catch (e) {
        if (intentos >= 2) throw new Error("No se pudo obtener el audio después de 2 intentos.")

      }
    }

    return winner
  }

  try {
    const winner = await tryDownload()

    const res = await yts(searchQuery)
    const video = res.videos[0]
    const videoUrl = video.url
    const title = video.title || "Desconocido"
    const artista = video.author?.name || "Desconocido"
    const duration = video.timestamp || "Desconocida"
    const thumbnail = video.image || null

    audioDownloadUrl = winner.url
    calidadElegida = winner.quality
    apiUsada = winner.api

    const tmp = path.join(process.cwd(), "tmp")
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp)
    const file = path.join(tmp, `${Date.now()}_audio.mp3`)

    const dl = await axios.get(audioDownloadUrl, { responseType: "stream", timeout: 0 })
    let totalSize = 0
    dl.data.on("data", chunk => {
      totalSize += chunk.length
      if (totalSize > MAX_FILE_SIZE) dl.data.destroy()
    })

    await streamPipe(dl.data, fs.createWriteStream(file))

    const stats = fs.statSync(file)
    if (stats.size > MAX_FILE_SIZE) {
      fs.unlinkSync(file)
      throw new Error("El archivo excede el límite de 60 MB permitido por WhatsApp.")
    }

    await conn.sendMessage(
      msg.key.remoteJid,
      {
        image: { url: thumbnail },
        caption: `
> *𝙰𝚄𝙳𝙸𝙾 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳𝙴𝚁*

⭒ ִֶָ७ ꯭🎵˙⋆｡ - *𝚃𝚒́𝚝𝚞𝚕𝚘:* ${title}
⭒ ִֶָ७ ꯭🎤˙⋆｡ - *𝙰𝚛𝚝𝚒𝚜𝚝𝚊:* ${artista}
⭒ ִֶָ७ ꯭🕑˙⋆｡ - *𝙳𝚞𝚛𝚊𝚌𝚒ó𝚗:* ${duration}
⭒ ִֶָ७ ꯭📺˙⋆｡ - *𝙲𝚊𝚕𝚒𝚍𝚊𝚍:* ${calidadElegida}
⭒ ִֶָ७ ꯭🌐˙⋆｡ - *𝙰𝚙𝚒:* ${apiUsada}

» 𝙀𝙉𝙑𝙄𝘼𝙉𝘿𝙊 𝘼𝙐𝘿𝙄𝙊  🎧
» 𝘼𝙂𝙐𝘼𝙍𝘿𝙀 𝙐𝙉 𝙋𝙊𝘾𝙊...

⇆‌ ㅤ◁ㅤㅤ❚❚ㅤㅤ▷ㅤ↻

> \`\`\`© 𝖯𝗈𝗐𝖾𝗋𝖾𝖽 𝖻𝗒 𝗁𝖾𝗋𝗇𝖺𝗇𝖽𝖾𝗓.𝗑𝗒𝗓\`\`\`
        `.trim()
      },
      { quoted: msg }
    )

    await new Promise(res => setTimeout(res, 2000))

    await conn.sendMessage(
      msg.key.remoteJid,
      {
        audio: fs.readFileSync(file),
        mimetype: "audio/mpeg",
        fileName: `${title}.mp3`
      },
      { quoted: msg }
    )

    fs.unlinkSync(file)

    await conn.sendMessage(msg.key.remoteJid, {
      react: { text: "✅", key: msg.key }
    })
  } catch (e) {
    console.error(e)
    await conn.sendMessage(
      msg.key.remoteJid,
      { text: `⚠️ Error al descargar el audio:\n\n${e.message}` },
      { quoted: msg }
    )
  }
}

handler.command = ["play"]
export default handler