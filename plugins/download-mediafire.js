import fetch from "node-fetch";

const handler = async (msg, { conn, args, command }) => {
  const chatId = msg.key.remoteJid;
  const text = args.join(" ");
  const pref = global.prefixes?.[0] || ".";

  if (!text) {
    return conn.sendMessage(chatId, {
      text: `📎 *𝙸𝚗𝚐𝚛𝚎𝚜𝚊 𝚄𝚗 𝙴𝚗𝚕𝚊𝚌𝚎 𝚍𝚎 𝙼𝚎𝚍𝚒𝚊𝚏𝚒𝚛𝚎 𝙿𝚊𝚛𝚊 𝙳𝚎𝚜𝚌𝚊𝚛𝚐𝚊𝚛𝚕𝚘*`
    }, { quoted: msg });
  }

  if (!/^https?:\/\/(www\.)?mediafire\.com/.test(text)) {
    return conn.sendMessage(chatId, {
      text: `⚠️ *𝙴𝚗𝚕𝚊𝚌𝚎 𝚗𝚘 𝚟𝚊𝚕𝚒𝚍𝚘, 𝙰𝚜𝚎𝚐𝚞𝚛𝚊𝚝𝚎 𝚍𝚎 𝚚𝚞𝚎 𝚜𝚎𝚊 𝚞𝚗 𝚎𝚗𝚕𝚊𝚌𝚎 𝚍𝚎 𝚖𝚎𝚍𝚒𝚊𝚏𝚒𝚛𝚎*`
    }, { quoted: msg });
  }

  await conn.sendMessage(chatId, {
    react: { text: "🕒", key: msg.key }
  });

  try {
    const apiUrl = `https://api.neoxr.eu/api/mediafire?url=${encodeURIComponent(text)}&apikey=russellxz`;
    const response = await fetch(apiUrl);

    if (!response.ok) throw new Error(`API error: ${response.statusText}`);
    const data = await response.json();

    if (!data.status || !data.data?.url) throw new Error("No se pudo obtener el enlace de descarga.");

    const fileInfo = data.data;
    const fileResponse = await fetch(fileInfo.url);
    if (!fileResponse.ok) throw new Error("No se pudo descargar el archivo.");

    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

    await conn.sendMessage(chatId, {
      document: fileBuffer,
      mimetype: fileInfo.mime,
      fileName: fileInfo.title
    }, { quoted: msg });

    await conn.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    });

  } catch (err) {
    console.error("❌ Error en .mediafire:", err);
    await conn.sendMessage(chatId, {
      react: { text: "❌", key: msg.key }
    });
  }
};

handler.command = ["mediafire"];
export default handler;