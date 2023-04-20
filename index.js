	const readXlsxFile = require('read-excel-file/node');
const fetch = require('sync-fetch');
const exec = require('sync-exec');
const path = require('path');
const fs = require('fs');

const cooldown = [];
const cache = JSON.parse(fs.readFileSync("cache.json", "utf8"));
const configs = JSON.parse(fs.readFileSync("configs.json", "utf8"));
const telegram = configs.telegram;
const instagram = configs.instagram;
let offsetAtual = telegram.offset;

function setCooldown(idUsuario){
	const tsAtual = new Date().getTime();
	const usuario = getCooldown(idUsuario);
	usuario.ultimaMsg = tsAtual;
}

function isOnCooldown(idUsuario){
	const tsAtual = new Date().getTime();
	const usuario = getCooldown(idUsuario);
	const delay = (tsAtual - usuario.ultimaMsg);
	if(delay < configs.tempoCooldown){
		console.log(`[isOnCooldown] ${idUsuario}: ${delay}`);
		return true;
	} else {
		console.log(`[notOnCooldown] ${idUsuario}: ${delay}`);
		return false;
	}
}

function getCooldown(idUsuario){
	const busca = cooldown.filter(usuario => usuario.id == idUsuario);
	if(busca.length > 0){
		return busca[0];
	} else {
		const tsAtual = new Date().getTime();
		const novo = {id: idUsuario, ultimaMsg: 0};
		cooldown.push(novo);
		return novo;
	}
}

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

function execALPR(filePath) {
	const command = `${configs.alpr} -c br ${filePath}`;
	const result = exec(command);
	const output = result.stdout;
	return output;
}

async function getDadosFromExcel(placa){
	try{
		const COLUNA_ANO = 0;
		const COLUNA_COR = 4;
		const COLUNA_PLACA = 1;
		const COLUNA_SINISTRO = 7;
		const arquivo = await readXlsxFile("dados.xlsx");
		
		let nLinha = 0;
		const busca = arquivo.filter(linha => {
			nLinha++;
			const placaBusca = linha[COLUNA_PLACA];
			if(placaBusca){
				return placaBusca.trim().toLowerCase() == placa.trim().toLowerCase();
			} else {
				console.warn(`- Linha ${nLinha} não possui uma placa válida.`);
				return false;
			}
		})[0];

		if(busca){
			return {
				"ano": busca[COLUNA_ANO],
				"cor": busca[COLUNA_COR],
				"status": busca[COLUNA_SINISTRO]
			}
		} else {
			return false;
		}
	} catch(e){
		console.log(`[getDadosFromExcel] Erro pegando dado do arquivo 'dados.xlsx': `,e);
		return false;
	}
}

function getMessages() {
	let msgs = [];
	const payload = JSON.stringify({offset: offsetAtual});
	const dados = fetch(`https://api.telegram.org/bot${telegram.token}/getUpdates`, {body: payload, method: 'POST', headers: { 'Content-Type': 'application/json' }}).json();
	console.log(`[getMessages] offsetAtual: ${offsetAtual}`);
	if(dados.ok){
		dados.result.forEach(async (updt) => {
			if(updt.message){
				const msgRecebida = updt.message;

				// Tenta pegar placa da foto se exisitr
				let placasNaImg = "";
				let imageFileId = undefined;
				if(msgRecebida.photo){
					imageFileId = msgRecebida.photo.at(-1).file_id; // Última do array photo é a maior resolução				
				}
				if(imageFileId && configs.alpr){
					const arquivoImg = await savePhotoFromTelegram(imageFileId)
					console.log(`[getMessages] Imagem recebida, buscando placa no arquivo '${arquivoImg}'`);
					await new Promise(r => setTimeout(r, 2000));
					const resultadoALPR = execALPR(arquivoImg);
					const placas = getPlacasFromTexto(resultadoALPR);
					placasNaImg = placas.join(", ");
					console.log(`[getMessages] Encontradass: ${placasNaImg}`);
				}

				msgs.push({
					id: msgRecebida.message_id,
					from: msgRecebida.from.id,
					chatId: msgRecebida.chat.id,
					user: msgRecebida.chat.id,
					username: msgRecebida.chat.username,
					text: `${msgRecebida.text} ${msgRecebida.caption}	(${placasNaImg})`
				});
			}
			if(updt.update_id >= telegram.offset){
				telegram.offset = updt.update_id + 1;
				offsetAtual = updt.update_id + 1;
				console.log(`[getMessages] Novo offsetAtual: ${offsetAtual}`);
				try{
					fs.writeFileSync("configs.json", JSON.stringify(configs, null, 2));
				} catch(e){
					console.log(`[getMessages] Erro atualiazndo arquivo 'configs.json': `,e);
				}
			}
		});
	}
	return msgs;
}

function getPlacasFromTexto(text) {
	text = text.toUpperCase();
	const regex = /(?:^|\b)([a-zA-Z]{3})[\s-]?(\d{4}|(\d[a-zA-Z]\d{2}))(?:\b|$)/gm;
	const plates = [];

	let match;
	while ((match = regex.exec(text)) !== null) {
		let plate = match[1] + match[2];

		plates.push(plate.replace(/\s|-/g, '').toLowerCase());

		if (/^\d$/.test(match[2][1])) {
			const letter = String.fromCharCode(65 + Number.parseInt(match[2][1], 10));
			plate = match[1] + match[2][0] + letter + match[2].slice(2);
		} else if (/^[A-Z]$/.test(match[2][1])) {
			const number = String.fromCharCode(match[2][1].charCodeAt(0) - 65 + 48);
			plate = match[1] + match[2][0] + number + match[2].slice(2);
		}
		plates.push(plate.replace(/\s|-/g, '').toLowerCase());
	}

	return [...new Set(plates)];
}

function getTagFromCache(tag){
	const resultado = cache.filter(item => item.tag == tag);

	return resultado ? resultado[0] : false;
}

function fetchPostsInstagramByTag(tag) {
	tag = tag.toLowerCase();
	const url = `https://www.instagram.com/api/v1/tags/web_info/?tag_name=${tag}`;

	try {
		const tagFromCache = getTagFromCache(tag);

		if(tagFromCache && configs.usarCacheInsta){
			console.log(`[fetchPostsInstagramByTag] '${tag}' estava em cache.`);
			return [tagFromCache];
		} else 
		if(configs.buscarOnlineInsta){
			if(configs.usarCacheInsta){
				console.log(`[fetchPostsInstagramByTag] '${tag}' não está no cache, buscando...`);
			} else {
				console.log(`[fetchPostsInstagramByTag] Ignorado cache.`);
			}
			// Busca dado online
			const response = fetch(url, {
				headers: {
					'cookie': instagram.cookie,
					'user-agent': instagram.userAgent,
					'x-ig-app-id': instagram.xIgAppId
				}
			});

			if (response.status === 200) {
				const json = response.json();
				const sections = json?.data?.top?.sections;
				
				const items = sections.map(sec => {
					const media = sec.layout_content.medias[0].media;
					const item = {
						id: media.id,
						tag: tag,
						time: media.taken_at,
						image: media.carousel_media ? media.carousel_media[0].image_versions2.candidates[0].url : media.image_versions2.candidates[0].url, // If it's caroulsel, get the first one as the imageUrl
						likes: media.like_count,
						comments: media.comment_count,
						link: `https://www.instagram.com/p/${media.code}/`,
						text: media.caption.text
					};

					cache.push(item);
					return item;
				});

				fs.writeFileSync("cache.json", JSON.stringify(cache, null, 2));
				return items;
			}
		} else {
			console.log(`[fetchPostsInstagramByTag] Ignorado busca online.`)
			return [];
		}
	} catch (error) {
		console.error(error);
	}

	return [];
}


setInterval(async () => {
	const msgs = getMessages();
	for(let msg of msgs){
		if(msg.text.includes("/start")){
			sendMessage(telegram.respostaInicial, msg.id, msg.chatId);
		} else {
			// Verifica se tem placa na mensagem recebida
			const placas = getPlacasFromTexto(msg.text);
			console.log(`[getPlacasFromTexto] Encontrada ${placas.length}: ${placas.join(",").toUpperCase()}`);
			
			if(placas.length > 0){
				if(isOnCooldown(msg.from)){
					sendMessage(`🛑 <b>Atenção</b>: É necessário aguardar <i>${configs.tempoCooldown/1000}s</i> entre consultas.`,msg.id, msg.chatId);
					console.log(`[cooldown] ${msg.from} em cooldown`);
				} else {
					let nadaEncontrado = true;
					for(let placa of placas){
						if(nadaEncontrado){	// só envia 1x se achar 2x a mesma placa
							const resultadosInstagram = fetchPostsInstagramByTag(`sipt${placa}`);
							const resultadoExcel = await getDadosFromExcel(placa);
							const headerResposta = `🔎 <b>Resultado da placa <i>${placa.toUpperCase()}</i></b>`;

							let textoExcel = "";
							if(resultadoExcel){
								textoExcel = `ℹ️ ${resultadoExcel.ano} / ${resultadoExcel.cor} \n🚨 <b>Atenção</b>: Consta <i>${resultadoExcel.status}</i>.\n`;
							}

							if(resultadosInstagram.length > 0){
								const res = resultadosInstagram[0];
								console.log(res);
								const textoResposta = `${headerResposta}\n\n${res.text}\n\n${textoExcel}\n<i>👍 ${res.likes} 💬 ${res.comments}\n🌐 <a href='${res.link}'>Link do post</a></i>`;
								sendPhoto(textoResposta, res.image, msg.id, msg.chatId);
								nadaEncontrado = false;
							} else 
							if(resultadoExcel){
								// Se não achou post no insta, manda só que tem sinistro
								const textoResposta = `${headerResposta}\n\n${textoExcel}`;
								sendMessage(textoResposta,msg.id, msg.chatId);
								nadaEncontrado = false;
							}
						}
					}

					if(nadaEncontrado){
						const headerResposta = `🔎 <b>Resultado das placas <i>${placas.join(", ").toUpperCase()}</i></b>`;
						sendMessage(`${headerResposta}\n\n\t⚠️ Nenhum post encontrado, aguarde o admin se pronunciar!`, msg.id, msg.chatId);
					}

					setCooldown(msg.from);
				}
			}
		}
	}
}, telegram.pollingInterval);

console.log("SiPtBot inicializado.");
if(configs.tempoResetAutomatico > 0){
	console.log(`[SiPtBot] O bot irá reiniciar após ${configs.tempoResetAutomatico/1000} segundos.`);
	setTimeout(() => {
		process.exit(0);
	}, configs.tempoResetAutomatico);
}
