const fetch = require('sync-fetch');
const path = require('path');
const fs = require('fs');

const configs = JSON.parse(fs.readFileSync("configs.json", "utf8"));
const telegram = configs.telegram;
let offsetAtual = telegram.offset;

function sendMessage(msg, replyId, chatId){
	const payload = JSON.stringify({
		chat_id: chatId,
		text: msg,
		reply_to_message_id: replyId,
		parse_mode: "HTML"
	});

	return fetch(`https://api.telegram.org/bot${telegram.token}/sendMessage`,{
		body: payload,
		method: 'POST',
		headers: { 'Content-Type': 'application/json' }
	}).json(); 
}

function sendPhotoLocal(msg, filePath, replyId, chatId) {
	const photoStream = fs.createReadStream(filePath);
	let photoBuffer = Buffer.alloc(0);

	photoStream.on('data', function(chunk) {
		photoBuffer = Buffer.concat([photoBuffer, chunk]);
	});

	photoStream.on('end', function() {
		const formData = new FormData();
		const photoBlob = new Blob([photoBuffer], { type: 'image/jpeg' });

		formData.append('chat_id', chatId);
		formData.append('caption', msg);
		formData.append('reply_to_message_id', replyId);
		formData.append('parse_mode', 'HTML');
		formData.append('photo', photoBlob, path.basename(filePath));

		return fetch(`https://api.telegram.org/bot${telegram.token}/sendPhoto`, {
			method: 'POST',
			body: formData
		}).json();
	});
}

function sendPhotosLocal(msg, filePaths, replyId, chatId) {
	console.log("sendPhotosLocal", msg, filePaths, replyId, chatId);
	const payload = {
		chat_id: chatId,
		caption: msg,
		reply_to_message_id: replyId,
		parse_mode: "HTML"
	};

	const photos = filePaths.map((filePath) => {
		return {
			filename: filePath,
			contentType: 'image/jpeg',
			stream: fs.createReadStream(filePath)
		}
	});

	return fetch(`https://api.telegram.org/bot${telegram.token}/sendMediaGroup`, {
		method: 'POST',
		headers: {
			'Content-Type': 'multipart/form-data'
		},
		formData: {
			...payload,
			media: JSON.stringify(photos)
		}
	}).json();
}

function sendPhoto(msg, imageUrl, replyId, chatId){
	const payload = JSON.stringify({
		chat_id: chatId,
		caption: msg,
		photo: imageUrl,
		reply_to_message_id: replyId,
		parse_mode: "HTML"
	});

	return fetch(`https://api.telegram.org/bot${telegram.token}/sendPhoto`,{
		body: payload,
		method: 'POST',
		headers: { 'Content-Type': 'application/json' }
	}).json(); 
}

function sendPhotos(msg, imageUrls, replyId, chatId) {
	const payload = {
		chat_id: chatId,
		caption: msg,
		reply_to_message_id: replyId,
		parse_mode: "HTML"
	};

	const photos = imageUrls.map((imageUrl) => {
		return {
			type: 'photo',
			media: imageUrl
		}
	});

	return fetch(`https://api.telegram.org/bot${telegram.token}/sendMediaGroup`, {
		method: 'POST',
		headers: {
			'Content-Type': 'multipart/form-data'
		},
		formData: {
			...payload,
			media: JSON.stringify(photos)
		}
	}).json();
}

async function savePhotoFromTelegram(file_id) {
	const tempDir = path.join(__dirname, 'temp');
	if (!fs.existsSync(tempDir)) {
		fs.mkdirSync(tempDir);
	}

	const filename = Math.random().toString(36).substring(7) + '.jpg';
	const filePath = path.join(tempDir, filename);

	try {
		const data = fetch(`https://api.telegram.org/bot${telegram.token}/getFile?file_id=${file_id}`).json();
		const url = `https://api.telegram.org/file/bot${telegram.token}/${data.result.file_path}`;
		const fileData = fetch(url, {method: 'GET'});
		const fileWriter = await fs.createWriteStream(filePath);
		await fileData.body.pipe(fileWriter);

		console.log(`[savePhotoFromTelegram] Arquivo salvo em: ${filePath}`);
		return filePath;
	} catch (error) {
		console.error(`[savePhotoFromTelegram] Erro salvando arquivo: ${error}`);
		return false;
	}
}

function getMessages() {
	let msgs = [];
	const payload = JSON.stringify({offset: offsetAtual});
	const dados = fetch(`https://api.telegram.org/bot${telegram.token}/getUpdates`, {body: payload, method: 'POST', headers: { 'Content-Type': 'application/json' }}).json();
	if(dados.ok){
		dados.result.forEach(async (updt) => {

			if(updt.update_id >= telegram.offset){
				telegram.offset = updt.update_id + 1;
				offsetAtual = updt.update_id + 1;
				try{
					fs.writeFileSync("configs.json", JSON.stringify(configs, null, 2));
				} catch(e){
					console.log(`[getMessages] Erro atualiazndo arquivo 'configs.json': `,e);
				}
			}

			if(updt.message){
				const msgRecebida = updt.message;

				// Tenta pegar placa da foto se exisitr
				let placasNaImg = "";
				let imageFileId = undefined;
				if(msgRecebida.photo){
					imageFileId = msgRecebida.photo.at(-1).file_id; // Última do array photo é a maior resolução				
				}
				if(imageFileId && configs.alpr){
					const arquivoImg = await savePhotoFromTelegram(imageFileId);
					console.log(`[getMessages] Imagem recebida, buscando placa no arquivo '${arquivoImg}'`);
					await new Promise(r => setTimeout(r, 2000));
					const resultadoALPR = execALPR(arquivoImg);
					const placas = getPlacasFromTexto(resultadoALPR);
					placasNaImg = placas.join(", ");
					console.log(`[getMessages] Encontradas: ${placasNaImg}`);
				}

				msgs.push({
					id: msgRecebida.message_id,
					chatId: msgRecebida.chat.id,
					chat: msgRecebida.chat.id,
					from: msgRecebida.from.id,
					username: msgRecebida.from.username ?? "???",
					name: msgRecebida.from.first_name ?? "???",
					text: `${msgRecebida.text} ${msgRecebida.caption}	(${placasNaImg})`
				});
			}

		});
	}
	return msgs;
}

module.exports = { getMessages, sendMessage, sendPhotoLocal, sendPhotosLocal, sendPhoto, sendPhotos, savePhotoFromTelegram };