import axios from "axios"
import yts from "yt-search"
import fs from "fs"
import path from "path"
import { promisify } from "util"
import { pipeline } from "stream"

const streamPipe = promisify(pipeline)

const handler = async (msg, { conn, text }) => {
  if (!text || !text.trim()) {
    return conn.sendMessage(
      msg.key.remoteJid,
      { text: "*🎬 Ingresa el nombre de algún video*" },
      { quoted: msg }
    )
  }

  await conn.sendMessage(msg.key.remoteJid, {
    react: { text: "🕒", key: msg.key }
  })

  const res = await yts(text)
  const video = res.videos[0]
  if (!video) {
    return conn.sendMessage(
      msg.key.remoteJid,
      { text: "❌ Sin resultados." },
      { quoted: msg }
    )
  }

  const { url: videoUrl, title, timestamp: duration, author } = video
  const artista = author.name
  const posibles = ["1080p", "720p", "480p", "360p"]

  let videoDownloadUrl = null
  let calidadElegida = "Desconocida"
  let apiUsada = "Desconocida"

  try {
    const tryApi = async (apiName, buildUrl, controller) => {
      for (const q of posibles) {
        const apiUrl = buildUrl(q)
        try {
          const r = await axios.get(apiUrl, {
            timeout: 60000,
            signal: controller.signal
          })
          if (apiName === "MayAPI" && r.data?.status && r.data?.result?.url) {
            return {
              url: r.data.result.url,
              quality: r.data.result.quality || q,
              api: "MayAPI"
            }
          }
          if (apiName === "NeoxR" && r.data?.status && r.data?.data?.url) {
            return {
              url: r.data.data.url,
              quality: r.data.data.quality || q,
              api: "NeoxR"
            }
          }
        } catch {
          continue
        }
      }
      throw new Error(`${apiName} no pudo obtener el video`)
    }

    const controller1 = new AbortController()
    const controller2 = new AbortController()

    const mayApiPromise = tryApi(
      "MayAPI",
      (q) =>
        `https://mayapi.ooguy.com/ytdl?url=${encodeURIComponent(
          videoUrl
        )}&type=mp4&quality=${q}&apikey=may-0595dca2`,
      controller1
    )

    const neoxApiPromise = tryApi(
      "NeoxR",
      (q) =>
        `https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(
          videoUrl
        )}&type=video&quality=${q}&apikey=russellxz`,
      controller2
    )

    // Carrera entre las dos APIs
    const winner = await Promise.race([mayApiPromise, neoxApiPromise])

    // Cancelamos la otra API
    if (winner.api === "MayAPI") controller2.abort()
    else controller1.abort()

    videoDownloadUrl = winner.url
    calidadElegida = winner.quality
    apiUsada = winner.api

    if (!videoDownloadUrl) {
      throw new Error("No se pudo obtener el video en ninguna calidad.")
    }

    const tmp = path.join(process.cwd(), "tmp")
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp)
    const file = path.join(tmp, `${Date.now()}_vid.mp4`)

    const dl = await axios.get(videoDownloadUrl, {
      responseType: "stream",
      timeout: 0
    })
    await streamPipe(dl.data, fs.createWriteStream(file))

    await conn.sendMessage(
      msg.key.remoteJid,
      {
        video: fs.readFileSync(file),
        mimetype: "video/mp4",
        fileName: `${title}.mp4`,
        caption: `

> *𝚅𝙸𝙳𝙴𝙾 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳𝙴𝚁*

🎵 *𝚃𝚒́𝚝𝚞𝚕𝚘:* ${title}
🎤 *𝙰𝚛𝚝𝚒𝚜𝚝𝚊:* ${artista}
🕑 *𝙳𝚞𝚛𝚊𝚌𝚒𝚘́𝚗:* ${duration}
📺 *𝙲𝚊𝚕𝚒𝚍𝚊𝚍:* ${calidadElegida}
🌐 *𝙰𝚙𝚒:* ${apiUsada}
`.trim(),
        supportsStreaming: true,
        contextInfo: { isHd: true }
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
      { text: `⚠️ Error al descargar el video:\n\n${e.message}` },
      { quoted: msg }
    )
  }
}

handler.command = ["play2"]

export default handler