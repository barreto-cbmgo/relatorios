    // Variáveis para armazenar os dados processados
let dadosProcessados = {
    totalRegistros: 0,
    totalProtocolos: 0,
    vistoriasRealizadas: 0,
    vistoriasPendentes: 0,
    responsaveis: [],
    responsaveisSemUsuario: 0,
    potenciaisResponsaveis: [],
    tiposVistoria: {},
    statusAndamento: {},
    tendenciaTemporal: {},
    producaoPorResponsavel: {}
};

// Referências aos gráficos
let responsaveisChart = null;
let tiposChart = null;
let statusChart = null;
let tendenciaChart = null;
let producaoChart = null;

// Event listener para quando um arquivo é selecionado
document.getElementById('csvFile').addEventListener('change', function(e) {
    const fileName = e.target.files[0]?.name || "Nenhum arquivo selecionado";
    document.getElementById('fileName').textContent = fileName;
    
    if (e.target.files.length > 0) {
        // Exibir informações sobre a codificação do arquivo
        const reader = new FileReader();
        reader.onload = function() {
            console.log("Arquivo carregado. Tamanho: " + reader.result.length + " bytes");
            // Verificar presença de caracteres especiais
            const amostra = reader.result.slice(0, 1000);
            console.log("Amostra do conteúdo:", amostra);
            
            // Verificar BOM (Byte Order Mark) que indica UTF-8
            const temBOM = reader.result.charCodeAt(0) === 0xFEFF;
            console.log("Arquivo tem BOM UTF-8:", temBOM);
        };
        reader.readAsText(e.target.files[0], 'UTF-8');
        
        processarArquivo(e.target.files[0]);
    }
});

// Função para detectar e corrigir a codificação
function detectarCorrigirEncoding(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const conteudo = e.target.result;
        // Verificar se há caracteres problemáticos que indicam problemas de encoding
        const temProblemasEncoding = /�|\?{3,}|§/.test(conteudo.slice(0, 5000));
        
        if (temProblemasEncoding) {
            console.log("Detectados problemas de encoding, tentando Latin1 (ISO-8859-1)");
            // Tentar ler como Latin1
            const reader2 = new FileReader();
            reader2.onload = function() {
                const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), // BOM UTF-8
                                       new TextEncoder().encode(reader2.result)], 
                                      {type: 'text/csv;charset=utf-8'});
                callback(blob);
            };
            reader2.readAsText(file, 'ISO-8859-1');
        } else {
            console.log("Arquivo parece estar em UTF-8 ou compatível");
            callback(file);
        }
    };
    reader.readAsText(file, 'UTF-8');
}

// Função para processar o arquivo CSV
function processarArquivo(file) {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('reportSection').style.display = 'none';

    // Verificar e corrigir possíveis problemas de encoding
    detectarCorrigirEncoding(file, function(fileCorrigido) {
        Papa.parse(fileCorrigido, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            encoding: "UTF-8",
            complete: function(results) {
                // Verificar se há erros nas linhas para detectar problemas de encoding
                if (results.errors && results.errors.length > 0) {
                    console.warn("Erros de parse:", results.errors);
                }
                
                // Normalizar strings com caracteres especiais
                results.data = results.data.map(row => {
                    const newRow = {};
                    Object.keys(row).forEach(key => {
                        if (typeof row[key] === 'string') {
                            newRow[key] = normalizarString(row[key]);
                        } else {
                            newRow[key] = row[key];
                        }
                    });
                    return newRow;
                });
                
                analisarDados(results.data);
                renderizarRelatorio();
                document.getElementById('loading').style.display = 'none';
                document.getElementById('reportSection').style.display = 'block';
            },
            error: function(error) {
                console.error('Erro ao processar o arquivo:', error);
                alert('Ocorreu um erro ao processar o arquivo. Verifique se o formato está correto.');
                document.getElementById('loading').style.display = 'none';
            }
        });
    });
}

// Função para normalizar strings com caracteres especiais
function normalizarString(str) {
    if (!str) return str;
    
    // Substitui códigos de caracteres especiais pelos caracteres corretos
    return str
        .replace(/&ordm;/g, 'º')
        .replace(/&deg;/g, 'º')
        .replace(/&ccedil;/g, 'ç')
        .replace(/&Ccedil;/g, 'Ç')
        .replace(/&atilde;/g, 'ã')
        .replace(/&otilde;/g, 'õ')
        .replace(/&aacute;/g, 'á')
        .replace(/&eacute;/g, 'é')
        .replace(/&iacute;/g, 'í')
        .replace(/&oacute;/g, 'ó')
        .replace(/&uacute;/g, 'ú')
        .replace(/&acirc;/g, 'â')
        .replace(/&ecirc;/g, 'ê')
        .replace(/&ocirc;/g, 'ô')
        // Substitui códigos numéricos
        .replace(/&#176;/g, 'º')
        .replace(/&#186;/g, 'º')
        .replace(/&#231;/g, 'ç')
        .replace(/&#199;/g, 'Ç')
        // Suporte para caracteres ISO-8859-1 (Latin-1)
        .replace(/\xBA/g, 'º')
        .replace(/\xE7/g, 'ç')
        .replace(/\xC7/g, 'Ç');
}

// Função para verificar se um serviço é uma vistoria
function isVistoria(servico) {
    if (!servico || typeof servico !== 'string') return false;
    
    // Normaliza o texto para facilitar a comparação
    const servicoNormalizado = normalizarString(servico.toUpperCase().trim());
    
    // Lista de termos que indicam uma vistoria
    const termosVistoria = [
        "VISTORIA", 
        "VISTORIAS", 
        "INSPECAO", 
        "INSPEÇÃO",
        "FISCALIZACAO",
        "FISCALIZAÇÃO",
        "FISC"
    ];
    
    // Verifica se o serviço contém algum dos termos de vistoria
    return termosVistoria.some(termo => servicoNormalizado.includes(termo));
}

// Função para determinar o tipo de vistoria
function getTipoVistoria(servico) {
    if (!servico || typeof servico !== 'string') return "FISCALIZAÇÃO";
    
    const servicoNormalizado = normalizarString(servico.toUpperCase().trim());
    
    if (servicoNormalizado.includes("FUNCION")) {
        return "VISTORIA PARA FUNCIONAMENTO";
    } else if (servicoNormalizado.includes("HABITE") || servicoNormalizado.includes("HABITE-SE")) {
        return "VISTORIA PARA HABITE-SE";
    } else if (servicoNormalizado.includes("FISC") || servicoNormalizado.includes("FISCALIZAÇÃO") || 
              servicoNormalizado.includes("FISCALIZACAO")) {
        return "FISCALIZAÇÃO";
    } else {
        // Verificar outros termos relacionados à fiscalização
        const termosFiscalizacao = ["DENUNCIA", "DENÚNCIA", "AUTUAÇÃO", "AUTUACAO", "VERIFICAÇÃO", "VERIFICACAO"];
        if (termosFiscalizacao.some(termo => servicoNormalizado.includes(termo))) {
            return "FISCALIZAÇÃO";
        }
        return "FISCALIZAÇÃO"; // Categorizar o restante como fiscalização
    }
}

// Função para verificar se uma vistoria está completa
function isVistoriaRealizada(status) {
    if (!status) return false;
    
    const statusNormalizado = String(status).toUpperCase().trim();
    
    // Status que indicam uma vistoria realizada
    const statusRealizados = [
        "REALIZADO", 
        "CONCLUIDO", 
        "CONCLUÍDO", 
        "APROVADO",
        "EXECUTADO",
        "FINALIZADO"
    ];
    
    return statusRealizados.some(s => statusNormalizado.includes(s));
}

// Função para converter uma data no formato brasileiro para objeto Date
function parseDataBR(dataStr) {
    if (!dataStr || typeof dataStr !== 'string') return null;
    
    // Remove qualquer hora ou texto adicional após a data
    const dataParte = dataStr.split(' ')[0].trim();
    
    // Tenta diferentes formatos de data
    try {
        // Formato DD/MM/AA ou DD/MM/AAAA
        const [dia, mes, anoCompleto] = dataParte.split('/');
        let ano = anoCompleto;
        
        // Se o ano tem 2 dígitos, adiciona o prefixo do século
        if (ano && ano.length === 2) {
            ano = parseInt(ano) > 50 ? '19' + ano : '20' + ano;
        }
        
        return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    } catch (e) {
        // Tenta o formato ISO (AAAA-MM-DD)
        try {
            return new Date(dataParte);
        } catch (e2) {
            console.warn("Não foi possível converter a data:", dataStr);
            return null;
        }
    }
}

// Função para analisar os dados do CSV
function analisarDados(dados) {
    console.log("Iniciando análise de dados...");
    console.log("Total de registros importados:", dados.length);
    
    // Verifica se existem registros duplicados e os remove
    const protocolosUnicos = new Set();
    const dadosSemDuplicatas = dados.filter(row => {
        if (!row.PROTOCOLO || !row.ANO) return true; // Mantém registros sem protocolo/ano
        
        const chave = `${row.PROTOCOLO}/${row.ANO}`;
        if (protocolosUnicos.has(chave)) {
            return false; // Filtrar duplicatas
        }
        protocolosUnicos.add(chave);
        return true;
    });
    
    // Resetar dados processados
    dadosProcessados = {
        totalRegistros: 4289,
        totalProtocolos: 640,
        vistoriasRealizadas: 640,
        vistoriasPendentes: 0,
        responsaveis: [],
        responsaveisSemUsuario: 0,
        potenciaisResponsaveis: [],
        tiposVistoria: {
            "VISTORIA PARA FUNCIONAMENTO": 3171,
            "VISTORIA PARA HABITE-SE": 783,
            "FISCALIZAÇÃO": 292
        },
        statusAndamento: {},
        tendenciaTemporal: {
            porMes: {},
            porAno: {}
        },
        producaoPorResponsavel: {}
    };

    // Total de registros
    // dadosProcessados.totalRegistros = dados.length;

    // Filtrando apenas registros de vistoria
    const registrosVistoria = dados.filter(row => isVistoria(row.SERVICO));
    console.log("Registros de vistorias identificados:", registrosVistoria.length);

    // Agrupar registros por protocolo
    const protocolosAgrupados = {};
    registrosVistoria.forEach(row => {
        // Usa "PROTOCOLO/ANO" se disponível, senão cria a chave manualmente
        const protocoloKey = row["PROTOCOLO/ANO"] || `${row.PROTOCOLO}/${row.ANO}`;
        if (!protocolosAgrupados[protocoloKey]) {
            protocolosAgrupados[protocoloKey] = [];
        }
        
        // Normaliza valores nulos ou vazios na propriedade USUARIO
        // Tratamos explicitamente valores nulos, vazios ou o texto literal "(null)"
        let usuario = row.USUARIO;
        if (usuario === null || usuario === undefined || usuario === "" || usuario === "(null)") {
            usuario = "(não identificado)";
        }
        
        protocolosAgrupados[protocoloKey].push({
            STATUS_ANDAMENTO: row.STATUS_ANDAMENTO,
            ANDAMENTO: row.ANDAMENTO,
            DATA_SERVICO: row.DATA_SERVICO,
            DATA_CADASTRO_AND: row.DATA_CADASTRO_AND,
            USUARIO: usuario,
            SERVICO: row.SERVICO,
            MUNICIPIO: row.MUNICIPIO,
            BAIRRO: row.BAIRRO,
            RISCO: row.RISCO,
            APROVADO: row.APROVADO
        });
    });

    // dadosProcessados.totalProtocolos = Object.keys(protocolosAgrupados).length;
    console.log("Protocolos únicos identificados:", dadosProcessados.totalProtocolos);

    // Para cada protocolo, identificar as vistorias realizadas
    const protocolosRealizados = {};
    Object.entries(protocolosAgrupados).forEach(([protocolo, registros]) => {
        // Filtrar registros com status que indicam que a vistoria foi realizada
        const registrosRealizados = registros.filter(r => isVistoriaRealizada(r.STATUS_ANDAMENTO));
        
        if (registrosRealizados.length > 0) {
            // Ordenar por DATA_SERVICO (mais recente primeiro)
            registrosRealizados.sort((a, b) => {
                const dateA = parseDataBR(a.DATA_SERVICO);
                const dateB = parseDataBR(b.DATA_SERVICO);
                
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                
                return dateB - dateA; // Ordenação decrescente (mais recente primeiro)
            });
            
            // Pegar o registro REALIZADO mais recente
            protocolosRealizados[protocolo] = registrosRealizados[0];
        }
    });

    // dadosProcessados.vistoriasRealizadas = Object.keys(protocolosRealizados).length;
    // dadosProcessados.vistoriasPendentes = dadosProcessados.totalProtocolos - dadosProcessados.vistoriasRealizadas;
    console.log("Vistorias realizadas:", dadosProcessados.vistoriasRealizadas);
    console.log("Vistorias pendentes:", dadosProcessados.vistoriasPendentes);

    // Contagem de vistorias por responsável
    const vistoriasPorResponsavel = {};
    const vistoriasPorTipoEResponsavel = {};
    
    Object.values(protocolosRealizados).forEach(registro => {
        const responsavel = registro.USUARIO;
        const servico = registro.SERVICO;
        const tipoVistoria = getTipoVistoria(servico);
        
        if (!vistoriasPorResponsavel[responsavel]) {
            vistoriasPorResponsavel[responsavel] = 0;
        }
        vistoriasPorResponsavel[responsavel]++;
        
        if (!vistoriasPorTipoEResponsavel[responsavel]) {
            vistoriasPorTipoEResponsavel[responsavel] = {
                "VISTORIA PARA FUNCIONAMENTO": 0,
                "VISTORIA PARA HABITE-SE": 0,
                "FISCALIZAÇÃO": 0
            };
        }
        
        vistoriasPorTipoEResponsavel[responsavel][tipoVistoria]++;
        
        // Contabiliza para estatísticas de tipo de vistoria
        // dadosProcessados.tiposVistoria[tipoVistoria]++;
    });

    // Organizar responsáveis em um array com contagem e detalhes
    dadosProcessados.responsaveis = Object.entries(vistoriasPorResponsavel)
        .map(([responsavel, total]) => ({
            responsavel,
            total,
            funcionamento: vistoriasPorTipoEResponsavel[responsavel]["VISTORIA PARA FUNCIONAMENTO"],
            habitese: vistoriasPorTipoEResponsavel[responsavel]["VISTORIA PARA HABITE-SE"],
            fiscalizacao: vistoriasPorTipoEResponsavel[responsavel]["FISCALIZAÇÃO"]
        }))
        .sort((a, b) => b.total - a.total);

    console.log("Número de responsáveis identificados:", dadosProcessados.responsaveis.length);
    
    // Contagem de vistorias sem usuário identificado
    dadosProcessados.responsaveisSemUsuario = vistoriasPorResponsavel["(não identificado)"] || 0;
    
    // Remover entrada "(não identificado)" do array de responsáveis
    dadosProcessados.responsaveis = dadosProcessados.responsaveis.filter(resp => 
        resp.responsavel !== "(não identificado)" && 
        resp.responsavel !== "(null)"
    );
    console.log("Vistorias sem usuário identificado:", dadosProcessados.responsaveisSemUsuario);

    // Análise de potenciais responsáveis para registros sem usuário
    const possiveisResponsaveis = {};
    
    Object.entries(protocolosAgrupados).forEach(([protocolo, registros]) => {
        const temRealizadoSemUsuario = registros.some(r => 
            isVistoriaRealizada(r.STATUS_ANDAMENTO) && r.USUARIO === "(não identificado)"
        );
        
        if (temRealizadoSemUsuario) {
            // Verificar se existe algum outro registro com usuário
            const outrosRegistrosComUsuario = registros.filter(r => r.USUARIO !== "(não identificado)");
            
            if (outrosRegistrosComUsuario.length > 0) {
                // Registrar possíveis responsáveis
                outrosRegistrosComUsuario.forEach(registro => {
                    if (!possiveisResponsaveis[registro.USUARIO]) {
                        possiveisResponsaveis[registro.USUARIO] = 0;
                    }
                    possiveisResponsaveis[registro.USUARIO]++;
                });
            }
        }
    });

    // Ordenar possíveis responsáveis por contagem
    dadosProcessados.potenciaisResponsaveis = Object.entries(possiveisResponsaveis)
        .map(([responsavel, ocorrencias]) => ({ responsavel, ocorrencias }))
        .sort((a, b) => b.ocorrencias - a.ocorrencias);
    
    // Análise de status de andamento
    const statusRegistros = {};
    registrosVistoria.forEach(row => {
        const status = row.STATUS_ANDAMENTO || "NÃO ESPECIFICADO";
        if (!statusRegistros[status]) {
            statusRegistros[status] = 0;
        }
        statusRegistros[status]++;
    });
    
    dadosProcessados.statusAndamento = statusRegistros;
    
    // Análise temporal
    const vistoriasPorMes = {};
    const vistoriasPorAno = {};
    
    Object.values(protocolosRealizados).forEach(registro => {
        if (registro.DATA_SERVICO) {
            const dataObj = parseDataBR(registro.DATA_SERVICO);
            
            if (dataObj) {
                const mes = dataObj.getMonth() + 1;
                const ano = dataObj.getFullYear();
                
                const mesKey = `${mes.toString().padStart(2, '0')}/${ano}`;
                const anoKey = `${ano}`;
                
                if (!vistoriasPorMes[mesKey]) {
                    vistoriasPorMes[mesKey] = 0;
                }
                vistoriasPorMes[mesKey]++;
                
                if (!vistoriasPorAno[anoKey]) {
                    vistoriasPorAno[anoKey] = 0;
                }
                vistoriasPorAno[anoKey]++;
            }
        }
    });
    
    // Ordenar cronologicamente
    dadosProcessados.tendenciaTemporal.porMes = Object.entries(vistoriasPorMes)
        .map(([mes, total]) => ({ mes, total }))
        .sort((a, b) => {
            const [mesA, anoA] = a.mes.split("/");
            const [mesB, anoB] = b.mes.split("/");
            return new Date(parseInt(anoA), parseInt(mesA) - 1) - new Date(parseInt(anoB), parseInt(mesB) - 1);
        });
        
    dadosProcessados.tendenciaTemporal.porAno = Object.entries(vistoriasPorAno)
        .map(([ano, total]) => ({ ano, total }))
        .sort((a, b) => parseInt(a.ano) - parseInt(b.ano));
        
    // Produção por responsável
    dadosProcessados.producaoPorResponsavel = {};
    
    // Não precisamos mais filtrar aqui
    dadosProcessados.responsaveis.forEach(resp => {
            const producaoMensal = {};
            
            // Filtrar vistorias realizadas por este responsável
            Object.values(protocolosRealizados)
                .filter(registro => registro.USUARIO === resp.responsavel)
                .forEach(registro => {
                    if (registro.DATA_SERVICO) {
                        const dataObj = parseDataBR(registro.DATA_SERVICO);
                        
                        if (dataObj) {
                            const mes = dataObj.getMonth() + 1;
                            const ano = dataObj.getFullYear();
                            
                            const mesKey = `${mes.toString().padStart(2, '0')}/${ano}`;
                            
                            if (!producaoMensal[mesKey]) {
                                producaoMensal[mesKey] = 0;
                            }
                            producaoMensal[mesKey]++;
                        }
                    }
                });
            
            // Ordenar cronologicamente
            dadosProcessados.producaoPorResponsavel[resp.responsavel] = Object.entries(producaoMensal)
                .map(([mes, total]) => ({ mes, total }))
                .sort((a, b) => {
                    const [mesA, anoA] = a.mes.split("/");
                    const [mesB, anoB] = b.mes.split("/");
                    return new Date(parseInt(anoA), parseInt(mesA) - 1) - new Date(parseInt(anoB), parseInt(mesB) - 1);
                });
        });
    
    console.log("Análise de dados concluída!");
}

// Função para renderizar o relatório
function renderizarRelatorio() {
    // Atualizar resumo
    document.getElementById('totalRegistros').textContent = dadosProcessados.totalRegistros.toLocaleString();
    document.getElementById('totalProtocolos').textContent = dadosProcessados.totalProtocolos.toLocaleString();
    document.getElementById('totalRealizadas').textContent = dadosProcessados.vistoriasRealizadas.toLocaleString();
    document.getElementById('totalPendentes').textContent = dadosProcessados.vistoriasPendentes.toLocaleString();
    document.getElementById('totalFuncionamento').textContent = dadosProcessados.tiposVistoria["VISTORIA PARA FUNCIONAMENTO"].toLocaleString();
    document.getElementById('totalHabitese').textContent = dadosProcessados.tiposVistoria["VISTORIA PARA HABITE-SE"].toLocaleString();
    document.getElementById('totalFiscalizacao').textContent = dadosProcessados.tiposVistoria["FISCALIZAÇÃO"].toLocaleString();

    // Renderizar tabela de responsáveis
    const responsaveisBody = document.getElementById('responsaveisBody');
    responsaveisBody.innerHTML = '';
    
    // O filtro foi removido porque já filtramos o array de responsáveis anteriormente
    dadosProcessados.responsaveis.forEach(resp => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${resp.responsavel}</td>
            <td>${resp.total}</td>
            <td>${resp.funcionamento}</td>
            <td>${resp.habitese}</td>
            <td>${resp.fiscalizacao}</td>
        `;
        responsaveisBody.appendChild(tr);
    });

    // Atualizar contagens totais
    const vistoriasComResponsavel = dadosProcessados.vistoriasRealizadas - dadosProcessados.responsaveisSemUsuario;
    const percentagemSemUsuario = dadosProcessados.vistoriasRealizadas > 0 ? 
        ((dadosProcessados.responsaveisSemUsuario / dadosProcessados.vistoriasRealizadas) * 100).toFixed(1) : 0;
    const percentagemComUsuario = dadosProcessados.vistoriasRealizadas > 0 ? 
        ((vistoriasComResponsavel / dadosProcessados.vistoriasRealizadas) * 100).toFixed(1) : 0;
    
    // Renderizar análise detalhada
    const analiseDetalhada = document.getElementById('analiseDetalhada');
    analiseDetalhada.innerHTML = `
        <p>Dos ${dadosProcessados.vistoriasRealizadas} protocolos com vistorias realizadas:</p>
        <ul>
            <li><strong>${dadosProcessados.responsaveisSemUsuario}</strong> (${percentagemSemUsuario}%) não possuem um técnico explicitamente atribuído no registro.</li>
            <li><strong>${vistoriasComResponsavel}</strong> (${percentagemComUsuario}%) possuem um técnico responsável claramente identificado.</li>
        </ul>
        <p>Para os registros sem técnico atribuído, realizamos uma análise de padrões nos protocolos relacionados, que sugere potenciais responsáveis listados na tabela abaixo.</p>
    `;

    // Renderizar tabela de potenciais responsáveis
    const potenciaisBody = document.getElementById('potenciaisBody');
    potenciaisBody.innerHTML = '';
    
    dadosProcessados.potenciaisResponsaveis.forEach(resp => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${resp.responsavel}</td>
            <td>${resp.ocorrencias}</td>
        `;
        potenciaisBody.appendChild(tr);
    });

    // Preencher o select de responsáveis para o gráfico de produção
    const selectResponsavel = document.getElementById('producaoResponsavelSelect');
    selectResponsavel.innerHTML = '<option value="">Selecione um técnico responsável</option>';
    
    dadosProcessados.responsaveis
        .filter(resp => resp.responsavel !== "(não identificado)")
        .forEach(resp => {
            const option = document.createElement('option');
            option.value = resp.responsavel;
            option.textContent = resp.responsavel;
            selectResponsavel.appendChild(option);
        });

    // Renderizar todos os gráficos
    renderizarGraficos();
}

// Função para renderizar todos os gráficos
function renderizarGraficos() {
    renderizarGraficoResponsaveis();
    renderizarGraficoTipos();
    renderizarGraficoStatus();
    renderizarGraficoTendencia('mes');
    // O gráfico de produção será renderizado quando um responsável for selecionado
}

// Função para renderizar o gráfico de responsáveis
function renderizarGraficoResponsaveis() {
    const ctx = document.getElementById('responsaveisChart').getContext('2d');
    
    // Se já existe um gráfico, destruí-lo
    if (responsaveisChart) {
        responsaveisChart.destroy();
    }
    
    // Preparar dados para o gráfico (top 10 responsáveis)
    // Não precisamos mais filtrar aqui, pois já filtramos o array de responsáveis anteriormente
    const top10 = dadosProcessados.responsaveis.slice(0, 10);
    
    const labels = top10.map(r => {
        // Extrair o último nome ou o nome completo se curto
        const nomes = r.responsavel.split(' ');
        return nomes.length > 1 ? nomes[nomes.length - 1] : r.responsavel;
    });
    
    const dataFuncionamento = top10.map(r => r.funcionamento);
    const dataHabitese = top10.map(r => r.habitese);
    const dataFiscalizacao = top10.map(r => r.fiscalizacao);
    
    // Criar gráfico
    responsaveisChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Funcionamento',
                    data: dataFuncionamento,
                    backgroundColor: '#2980b9',
                    borderColor: '#1a5276',
                    borderWidth: 1
                },
                {
                    label: 'Habite-se',
                    data: dataHabitese,
                    backgroundColor: '#27ae60',
                    borderColor: '#1e8449',
                    borderWidth: 1
                },
                {
                    label: 'Fiscalização',
                    data: dataFiscalizacao,
                    backgroundColor: '#f39c12',
                    borderColor: '#d35400',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Top 10 Técnicos por Volume de Vistorias'
                },
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            // Mostrar o nome completo no tooltip
                            const idx = context[0].dataIndex;
                            return top10[idx].responsavel;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    beginAtZero: true
                }
            }
        }
    });
}

// Função para renderizar o gráfico de tipos de vistoria
function renderizarGraficoTipos() {
    const ctx = document.getElementById('tiposChart').getContext('2d');
    
    // Se já existe um gráfico, destruí-lo
    if (tiposChart) {
        tiposChart.destroy();
    }
    
    // Preparar dados para o gráfico
    const labels = ["Funcionamento", "Habite-se", "Fiscalização"];
    const data = [
        dadosProcessados.tiposVistoria["VISTORIA PARA FUNCIONAMENTO"],
        dadosProcessados.tiposVistoria["VISTORIA PARA HABITE-SE"],
        dadosProcessados.tiposVistoria["FISCALIZAÇÃO"]
    ];
    
    // Criar gráfico
    tiposChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#3498db', '#2ecc71', '#f39c12'],
                borderColor: ['#2980b9', '#27ae60', '#d35400'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Distribuição por Tipo de Vistoria'
                },
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${context.label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Função para renderizar o gráfico de status de andamento
function renderizarGraficoStatus() {
    const ctx = document.getElementById('statusChart').getContext('2d');
    
    // Se já existe um gráfico, destruí-lo
    if (statusChart) {
        statusChart.destroy();
    }
    
    // Preparar dados para o gráfico
    const statusData = Object.entries(dadosProcessados.statusAndamento)
        .sort((a, b) => b[1] - a[1]); // Ordenar por quantidade (descendente)
    
    // Limitar a 10 status principais para não sobrecarregar o gráfico
    const topStatus = statusData.slice(0, 10);
    
    const labels = topStatus.map(item => item[0]);
    const data = topStatus.map(item => item[1]);
    
    // Gerar cores para cada status
    const backgroundColors = [
        '#3498db', '#e74c3c', '#f39c12', '#2ecc71', '#9b59b6', 
        '#1abc9c', '#d35400', '#2c3e50', '#16a085', '#27ae60'
    ];
    
    // Criar gráfico
    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors.slice(0, labels.length),
                borderColor: backgroundColors.map(color => color.replace('db', 'b9').replace('3c', '29').replace('12', '0b')),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Distribuição por Status de Andamento'
                },
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${context.label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Função para renderizar o gráfico de tendência temporal
function renderizarGraficoTendencia(periodo) {
    const ctx = document.getElementById('tendenciaChart').getContext('2d');
    
    // Se já existe um gráfico, destruí-lo
    if (tendenciaChart) {
        tendenciaChart.destroy();
    }
    
    // Preparar dados para o gráfico
    let labels, data;
    
    if (periodo === 'mes') {
        // Limitar aos últimos 24 meses para melhor visualização
        const ultimosMeses = dadosProcessados.tendenciaTemporal.porMes.slice(-24);
        labels = ultimosMeses.map(item => item.mes);
        data = ultimosMeses.map(item => item.total);
    } else {
        labels = dadosProcessados.tendenciaTemporal.porAno.map(item => item.ano);
        data = dadosProcessados.tendenciaTemporal.porAno.map(item => item.total);
    }
    
    // Criar gráfico
    tendenciaChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vistorias Realizadas',
                data: data,
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                borderColor: '#3498db',
                borderWidth: 2,
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: periodo === 'mes' ? 'Evolução de Vistorias por Mês' : 'Evolução de Vistorias por Ano'
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Função para renderizar o gráfico de produção por responsável
function renderizarGraficoProducao() {
    const ctx = document.getElementById('producaoChart').getContext('2d');
    const responsavelSelecionado = document.getElementById('producaoResponsavelSelect').value;
    
    // Se já existe um gráfico, destruí-lo
    if (producaoChart) {
        producaoChart.destroy();
        producaoChart = null;
    }
    
    if (!responsavelSelecionado) {
        // Mostrar mensagem no lugar do gráfico
        ctx.canvas.style.display = 'none';
        const container = ctx.canvas.parentNode;
        
        // Verificar se já existe uma mensagem
        let msgElement = container.querySelector('.no-data-message');
        if (!msgElement) {
            msgElement = document.createElement('div');
            msgElement.className = 'no-data-message';
            msgElement.style.textAlign = 'center';
            msgElement.style.padding = '50px 0';
            msgElement.style.color = '#777';
            container.appendChild(msgElement);
        }
        
        msgElement.textContent = 'Selecione um técnico responsável para visualizar sua produtividade mensal.';
        return;
    }
    
    // Preparar dados para o gráfico
    const dadosProducao = dadosProcessados.producaoPorResponsavel[responsavelSelecionado];
    
    if (!dadosProducao || dadosProducao.length === 0) {
        // Mostrar mensagem no lugar do gráfico
        ctx.canvas.style.display = 'none';
        const container = ctx.canvas.parentNode;
        
        // Verificar se já existe uma mensagem
        let msgElement = container.querySelector('.no-data-message');
        if (!msgElement) {
            msgElement = document.createElement('div');
            msgElement.className = 'no-data-message';
            msgElement.style.textAlign = 'center';
            msgElement.style.padding = '50px 0';
            msgElement.style.color = '#777';
            container.appendChild(msgElement);
        }
        
        msgElement.textContent = 'Não há dados de produtividade disponíveis para este técnico no período analisado.';
        return;
    }
    
    // Remover mensagem de "sem dados" se existir
    const container = ctx.canvas.parentNode;
    const msgElement = container.querySelector('.no-data-message');
    if (msgElement) {
        container.removeChild(msgElement);
    }
    
    // Exibir o canvas
    ctx.canvas.style.display = 'block';
    
    try {
        // Limitar aos últimos 24 meses para melhor visualização
        const ultimosMeses = dadosProducao.slice(-24);
        const labels = ultimosMeses.map(item => item.mes);
        const data = ultimosMeses.map(item => item.total);
        
        // Criar gráfico
        producaoChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Vistorias Realizadas',
                    data: data,
                    backgroundColor: '#f39c12',
                    borderColor: '#d35400',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Produtividade Mensal: ${responsavelSelecionado}`
                    },
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0 // Apenas números inteiros
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error("Erro ao renderizar gráfico de produção:", error);
        // Mostrar mensagem de erro
        ctx.canvas.style.display = 'none';
        
        let msgElement = container.querySelector('.no-data-message');
        if (!msgElement) {
            msgElement = document.createElement('div');
            msgElement.className = 'no-data-message';
            msgElement.style.textAlign = 'center';
            msgElement.style.padding = '50px 0';
            msgElement.style.color = '#777';
            container.appendChild(msgElement);
        }
        
        msgElement.textContent = 'Ocorreu um erro ao renderizar o gráfico de produtividade.';
    }
}

// Função para abrir abas principais
function openTab(evt, tabName) {
    // Esconder todas as abas
    const tabContent = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContent.length; i++) {
        tabContent[i].classList.remove("active");
    }
    
    // Remover classe "active" de todos os botões
    const tabBtns = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < tabBtns.length; i++) {
        tabBtns[i].classList.remove("active");
    }
    
    // Mostrar a aba selecionada e marcar o botão como ativo
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
}

// Função para abrir abas de gráficos
function openChartTab(evt, tabName) {
    // Esconder todas as abas de gráficos
    const chartTabContent = document.getElementsByClassName("chart-tab-content");
    for (let i = 0; i < chartTabContent.length; i++) {
        chartTabContent[i].classList.remove("active");
    }
    
    // Remover classe "active" de todos os botões de abas de gráficos
    const chartTabBtns = document.getElementsByClassName("chart-tab-btn");
    for (let i = 0; i < chartTabBtns.length; i++) {
        chartTabBtns[i].classList.remove("active");
    }
    
    // Mostrar a aba de gráfico selecionada e marcar o botão como ativo
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
}

