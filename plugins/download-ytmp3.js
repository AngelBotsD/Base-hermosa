import axios from "axios";
import yts from "yt-search";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { promisify } from "util";
import { pipeline } from "stream";

const streamPipe = promisify(pipeline);

const handler = async (msg, { conn, text }) => {
  if (!text || !/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(text)) {
    return conn.sendMessage(
      msg.key.remoteJid,
      { text: `📎 *𝙸𝚗𝚐𝚛𝚎𝚜𝚊 𝚞𝚗 𝚕𝚒𝚗𝚔 𝚍𝚎 𝚢𝚘𝚞𝚝𝚞𝚋𝚎 𝙿𝚊𝚛𝚊 𝙳𝚎𝚜𝚌𝚊𝚛𝚐𝚊𝚛 𝚎𝚕 𝙰𝚞𝚍𝚒𝚘*` },
      { quoted: msg }
    );
  }

  await conn.sendMessage(msg.key.remoteJid, {
    react: { text: "🕒", key: msg.key }
  });

  try {
    const res = await yts({ videoId: text.split("v=")[1] || text.split("/").pop().split("?")[0] });
    const video = res || null;

    if (!video) {
      return conn.sendMessage(
        msg.key.remoteJid,
        { text: "❌ *𝙽𝚘 𝚜𝚎 𝚎𝚗𝚌𝚘𝚗𝚝𝚛𝚘 𝚒𝚗𝚏𝚘𝚛𝚖𝚊𝚌𝚒𝚘́𝚗*" },
        { quoted: msg }
      );
    }

    const { url: videoUrl, title, timestamp: duration, author, image: thumbnail } = video;
    const artista = author?.name || "Desconocido";

    const infoMsg = `
> *𝚈𝚃𝙼𝙿3 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳𝙴𝚁*

🎵 *𝚃𝚒𝚝𝚞𝚕𝚘:* ${title}
🎤 *𝙰𝚛𝚝𝚒𝚜𝚝𝚊:* ${artista}
🕑 *𝙳𝚞𝚛𝚊𝚌𝚒ó𝚗:* ${duration || "Desconocida"}
`.trim();

    await conn.sendMessage(
      msg.key.remoteJid,
      { image: { url: thumbnail }, caption: infoMsg },
      { quoted: msg }
    );

    const api = `https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(videoUrl)}&type=audio&quality=128kbps&apikey=russellxz`;
    const r = await axios.get(api);
    if (!r.data?.status || !r.data.data?.url) throw new Error("No se pudo obtener el audio");

    const tmp = path.join(process.cwd(), "tmp");
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp);
    const inFile = path.join(tmp, `${Date.now()}_in.m4a`);
    const outFile = path.join(tmp, `${Date.now()}_out.mp3`);

    const dl = await axios.get(r.data.data.url, { responseType: "stream" });
    await streamPipe(dl.data, fs.createWriteStream(inFile));

    await new Promise((res, rej) =>
      ffmpeg(inFile)
        .audioCodec("libmp3lame")
        .audioBitrate("128k")
        .format("mp3")
        .save(outFile)
        .on("end", res)
        .on("error", rej)
    );

    const buffer = fs.readFileSync(outFile);

    await conn.sendMessage(
      msg.key.remoteJid,
      {
        audio: buffer,
        mimetype: "audio/mpeg",
        fileName: `${title}.mp3`,
        ptt: false
      },
      { quoted: msg }
    );

    fs.unlinkSync(inFile);
    fs.unlinkSync(outFile);

    await conn.sendMessage(msg.key.remoteJid, {
      react: { text: "✅", key: msg.key }
    });
  } catch (e) {
    console.error(e);
    await conn.sendMessage(
      msg.key.remoteJid,
      { text: "⚠️ Error al descargar el audio." },
      { quoted: msg }
    );
  }
};

handler.command = ["ytmp3"];

export default handler;