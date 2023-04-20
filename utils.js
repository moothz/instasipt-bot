const readXlsxFile = require('read-excel-file/node');
const exec = require('sync-exec');
const path = require('path');
const fs = require('fs');

function findFilesStartingWith(folderPath, prefix) {
	const folder = path.resolve(folderPath);
	const files = fs.readdirSync(folder);
	const matchingFiles = files.filter((file) => file.toLowerCase().startsWith(prefix.toLowerCase()));
	return matchingFiles.map((file) => path.join(folder, file));
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
				"placa": busca[COLUNA_PLACA],
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

module.exports = { findFilesStartingWith, execALPR, getDadosFromExcel, getPlacasFromTexto };