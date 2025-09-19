import axios from "axios"
import fs from "fs"
import path from "path"

const handler = async (msg, { conn, args, command }) => {
  const chatId = msg.key.remoteJid
  const text = args.join(" ")
  const pref = global.prefixes?.[0] || "."

  if (!text) {
    return conn.sendMessage(chatId, {
      text: `🔗 *𝙸𝚗𝚐𝚛𝚎𝚜𝚊 𝚄𝚗 𝙻𝚒𝚗𝚔 𝙳𝚎 𝙵𝚊𝚌𝚎𝚋𝚘𝚘𝚔*`,
    }, { quoted: msg })
  }

  if (!text.match(/(facebook\.com|fb\.watch)/gi)) {
    return conn.sendMessage(chatId, {
      text: `🚩 *𝙽𝚘 𝚜𝚎 𝚎𝚗𝚌𝚘𝚗𝚝𝚛𝚊𝚛𝚘𝚗 𝚛𝚎𝚜𝚞𝚕𝚝𝚊𝚍𝚘𝚜.*`,
    }, { quoted: msg })
  }

  try {
    await conn.sendMessage(chatId, {
      react: { text: "🕒", key: msg.key }
    })

    const response = await axios.get(`https://api.dorratz.com/fbvideo?url=${encodeURIComponent(text)}`)
    const results = response.data

    if (!results || !results.length || !results[0].url) {
      return conn.sendMessage(chatId, {
        text: "🚫 *No se pudo obtener el video.*"
      }, { quoted: msg })
    }

    const tmpDir = path.resolve("./tmp")
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir)

    const videoUrl = results[0].url
    const filePath = path.join(tmpDir, `fb-${Date.now()}.mp4`)

    const videoRes = await axios.get(videoUrl, { responseType: "stream" })
    const writer = fs.createWriteStream(filePath)

    await new Promise((resolve, reject) => {
      videoRes.data.pipe(writer)
      writer.on("finish", resolve)
      writer.on("error", reject)
    })

    const stats = fs.statSync(filePath)
    const sizeMB = stats.size / (1024 * 1024)
    if (sizeMB > 500) {
      fs.unlinkSync(filePath)
      return conn.sendMessage(chatId, {
        text: `⚠️ *El archivo pesa ${sizeMB.toFixed(2)}MB*\n\n🔒 Solo se permiten videos menores a 99MB.`,
      }, { quoted: msg })
    }

    const caption = ``

    await conn.sendMessage(chatId, {
      video: fs.readFileSync(filePath),
      mimetype: "video/mp4",
      caption
    }, { quoted: msg })

    fs.unlinkSync(filePath)

    await conn.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    })

  } catch (err) {
    console.error("❌ Error en comando Facebook:", err)
    await conn.sendMessage(chatId, {
      text: "❌ *Ocurrió un error al procesar el video de Facebook.*"
    }, { quoted: msg })

    await conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    })
  }
}

handler.command = ["facebook", "fb"]
handler.help = ["facebook <url>", "fb <url>"]
handler.tags = ["descargas"]

export default handler