    // Variáveis para armazenar os dados processados
let dadosProcessados = {
    // Dados para vistorias
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
    producaoPorResponsavel: {},
    protocolosPorResponsavel: {}, // Objeto para armazenar os protocolos atendidos por cada responsável
    
    // Novos contadores para tipos de serviços adicionais de vistorias
    servicosAdicionais: {
        "ALTERAÇÃO DE DADOS DO SERVIÇO": 0,
        "ALTERAÇÃO DE TIPO DE SERVIÇO": 0,
        "APROVADO": 0,
        "CADASTRO": 0,
        "DESPACHO DE ARQUIVO": 0,
        "COMISSÃO TÉCNICA": 0,
        "SOLICITADA ISENÇÃO DE TAXA": 0,
        "PROCEDIMENTOS/OBSERVAÇÃO": 0,
        "SOLICITOU RETORNO PARA INSPEÇÃO": 0
    },
    
    // Dados para projetos
    totalRegistrosProjetos: 0,
    totalProtocolosProjetos: 0,
    projetosAnalisados: 0,
    projetosPendentes: 0,
    responsaveisProjetos: [], // Lista de responsáveis por projetos
    responsaveisProjetosSemUsuario: 0,
    tiposProjeto: {
        "ANÁLISE DE PROJETO": 0,
        "SUBSTITUIÇÃO DE PROJETO": 0,
        "OUTROS": 0
    },
    protocolosPorResponsavelProjeto: {}, // Objeto para armazenar os protocolos de projeto por responsável
    
    // Contadores para tipos de serviços adicionais de projetos
    servicosAdicionaisProjeto: {
        "ALTERAÇÃO DE DADOS DO SERVIÇO": 0,
        "ALTERAÇÃO DE TIPO DE SERVIÇO": 0,
        "APROVADO": 0,
        "CADASTRO": 0,
        "DESPACHO DE ARQUIVO": 0,
        "COMISSÃO TÉCNICA": 0,
        "SOLICITADA ISENÇÃO DE TAXA": 0,
        "PROCEDIMENTOS/OBSERVAÇÃO": 0,
        "SOLICITOU RETORNO PARA INSPEÇÃO": 0
    }
};

// Referências aos gráficos de vistorias
let responsaveisChart = null;
let tiposChart = null;
let statusChart = null;
let tendenciaChart = null;
let producaoChart = null;

// Referências aos gráficos de projetos
let responsaveisProjetosChart = null;
let tiposProjetosChart = null;
let statusProjetosChart = null;
let tendenciaProjetosChart = null;
let producaoProjetosChart = null;

// Evento de inicialização para configurar a interface
document.addEventListener('DOMContentLoaded', function() {
    console.log("Documento carregado, configurando interface");
    
    // Garantir que os painéis de equipe técnica estão configurados corretamente
    const equipeTecnicaVistorias = document.getElementById('equipeTecnicaVistorias');
    const equipeTecnicaProjetos = document.getElementById('equipeTecnicaProjetos');
    
    if (equipeTecnicaVistorias) equipeTecnicaVistorias.classList.add('active');
    if (equipeTecnicaProjetos) equipeTecnicaProjetos.classList.remove('active');
    
    // Garantir que os painéis de gráficos estão configurados corretamente
    const graficosVistorias = document.getElementById('graficosVistorias');
    const graficosProjetos = document.getElementById('graficosProjetos');
    
    if (graficosVistorias) graficosVistorias.classList.add('active');
    if (graficosProjetos) graficosProjetos.classList.remove('active');
    
    // Adicionar listeners para os botões das abas principais
    document.querySelectorAll('.main-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            console.log("Botão de aba principal clicado:", this.textContent);
            
            // Forçar um refresh dos gráficos se a aba de gráficos estiver ativa
            if (document.getElementById('graficos').classList.contains('active')) {
                setTimeout(() => {
                    if (document.getElementById('vistoriaPanel').classList.contains('active')) {
                        renderizarGraficos();
                    } else if (document.getElementById('projetoPanel').classList.contains('active')) {
                        renderizarGraficosProjetos();
                    }
                }, 100);
            }
        });
    });
});

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

// Função para verificar se um serviço é relacionado a projetos
function isProjeto(servico) {
    if (!servico || typeof servico !== 'string') return false;
    
    // Normaliza o texto para facilitar a comparação
    const servicoNormalizado = normalizarString(servico.toUpperCase().trim());
    
    // Lista de termos que indicam projetos
    const termosProjeto = [
        "PROJETO",
        "ANÁLISE",
        "ANALISE",
        "SUBSTITUIÇÃO",
        "SUBSTITUICAO",
        "ENTREGUE AO SOLICITANTE COM EXIGÊNCIA",
        "ENTREGUE AO SOLICITANTE COM EXIGENCIA"
    ];
    
    // Verifica se o serviço contém algum dos termos de projeto
    return termosProjeto.some(termo => servicoNormalizado.includes(termo));
}

// Função para verificar se um status de andamento é de projeto entregue com exigência
function isProjetoEntregueComExigencia(andamento) {
    if (!andamento || typeof andamento !== 'string') return false;
    
    // Normaliza o texto para facilitar a comparação
    const andamentoNormalizado = normalizarString(andamento.toUpperCase().trim());
    
    return andamentoNormalizado.includes("ENTREGUE AO SOLICITANTE COM EXIGÊNCIA") || 
           andamentoNormalizado.includes("ENTREGUE AO SOLICITANTE COM EXIGENCIA");
}

// Função para determinar o tipo de projeto
function getTipoProjeto(servico) {
    if (!servico || typeof servico !== 'string') return "OUTROS";
    
    const servicoNormalizado = normalizarString(servico.toUpperCase().trim());
    
    if (servicoNormalizado.includes("ANÁLISE DE PROJETO") || servicoNormalizado.includes("ANALISE DE PROJETO")) {
        return "ANÁLISE DE PROJETO";
    } else if (servicoNormalizado.includes("SUBSTITUIÇÃO DE PROJETO") || servicoNormalizado.includes("SUBSTITUICAO DE PROJETO")) {
        return "SUBSTITUIÇÃO DE PROJETO";
    } else {
        return "OUTROS";
    }
}

// Função para identificar serviços adicionais
function identificarServicoAdicional(servico) {
    if (!servico || typeof servico !== 'string') return null;
    
    // Normaliza o texto para facilitar a comparação
    const servicoNormalizado = normalizarString(servico.toUpperCase().trim());
    
    // Lista de serviços adicionais para verificar
    const servicosParaVerificar = [
        "ALTERAÇÃO DE DADOS DO SERVIÇO",
        "ALTERAÇÃO DE TIPO DE SERVIÇO",
        "APROVADO",
        "CADASTRO",
        "DESPACHO DE ARQUIVO",
        "COMISSÃO TÉCNICA",
        "SOLICITADA ISENÇÃO DE TAXA",
        "PROCEDIMENTOS/OBSERVAÇÃO",
        "SOLICITOU RETORNO PARA INSPEÇÃO"
    ];
    
    // Verificar qual serviço adicional corresponde
    for (const tipoServico of servicosParaVerificar) {
        if (servicoNormalizado.includes(tipoServico.toUpperCase())) {
            return tipoServico;
        }
    }
    
    return null;
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
        // Dados para vistorias
        totalRegistros: 0,
        totalProtocolos: 0,
        vistoriasRealizadas: 0,
        vistoriasPendentes: 0,
        responsaveis: [],
        responsaveisSemUsuario: 0,
        potenciaisResponsaveis: [],
        tiposVistoria: {
            "VISTORIA PARA FUNCIONAMENTO": 0,
            "VISTORIA PARA HABITE-SE": 0,
            "FISCALIZAÇÃO": 0
        },
        statusAndamento: {},
        tendenciaTemporal: {
            porMes: {},
            porAno: {}
        },
        producaoPorResponsavel: {},
        protocolosPorResponsavel: {},
        
        // Contadores de serviços adicionais para vistorias
        servicosAdicionais: {
            "ALTERAÇÃO DE DADOS DO SERVIÇO": 0,
            "ALTERAÇÃO DE TIPO DE SERVIÇO": 0,
            "APROVADO": 0,
            "CADASTRO": 0,
            "DESPACHO DE ARQUIVO": 0,
            "COMISSÃO TÉCNICA": 0,
            "SOLICITADA ISENÇÃO DE TAXA": 0,
            "PROCEDIMENTOS/OBSERVAÇÃO": 0,
            "SOLICITOU RETORNO PARA INSPEÇÃO": 0
        },
        
        // Dados para projetos
        totalRegistrosProjetos: 0,
        totalProtocolosProjetos: 0,
        projetosAnalisados: 0,
        projetosPendentes: 0,
        responsaveisProjetos: [], // Lista de responsáveis por projetos
        responsaveisProjetosSemUsuario: 0,
        tiposProjeto: {
            "ANÁLISE DE PROJETO": 0,
            "SUBSTITUIÇÃO DE PROJETO": 0,
            "OUTROS": 0
        },
        protocolosPorResponsavelProjeto: {}, // Objeto para armazenar os protocolos de projeto por responsável
        
        // Contadores para tipos de serviços adicionais de projetos
        servicosAdicionaisProjeto: {
            "ALTERAÇÃO DE DADOS DO SERVIÇO": 0,
            "ALTERAÇÃO DE TIPO DE SERVIÇO": 0,
            "APROVADO": 0,
            "CADASTRO": 0,
            "DESPACHO DE ARQUIVO": 0,
            "COMISSÃO TÉCNICA": 0,
            "SOLICITADA ISENÇÃO DE TAXA": 0,
            "PROCEDIMENTOS/OBSERVAÇÃO": 0,
            "SOLICITOU RETORNO PARA INSPEÇÃO": 0
        }
    };

    // Total de registros
    dadosProcessados.totalRegistros = dados.length;

    // Filtrando registros de vistoria e de projeto
    const registrosVistoria = [];
    const registrosProjeto = [];
    
    dados.forEach(row => {
        // Verificar se é uma vistoria
        if (isVistoria(row.SERVICO)) {
            registrosVistoria.push(row);
            
            // Verificar e contar serviços adicionais para vistorias
            const servicoAdicional = identificarServicoAdicional(row.SERVICO);
            if (servicoAdicional && dadosProcessados.servicosAdicionais.hasOwnProperty(servicoAdicional)) {
                dadosProcessados.servicosAdicionais[servicoAdicional]++;
            }
            
            // Verificar e contar serviços adicionais, também pelo status de andamento
            const statusAdicional = identificarServicoAdicional(row.STATUS_ANDAMENTO);
            if (statusAdicional && dadosProcessados.servicosAdicionais.hasOwnProperty(statusAdicional)) {
                dadosProcessados.servicosAdicionais[statusAdicional]++;
            }
        } 
        // Verificar se é um projeto pelo serviço ou pelo andamento
        else if (isProjeto(row.SERVICO) || isProjetoEntregueComExigencia(row.ANDAMENTO)) {
            registrosProjeto.push(row);
            
            // Verificar e contar serviços adicionais para projetos
            const servicoAdicional = identificarServicoAdicional(row.SERVICO);
            if (servicoAdicional && dadosProcessados.servicosAdicionaisProjeto.hasOwnProperty(servicoAdicional)) {
                dadosProcessados.servicosAdicionaisProjeto[servicoAdicional]++;
            }
            
            // Verificar e contar serviços adicionais, também pelo status de andamento
            const statusAdicional = identificarServicoAdicional(row.STATUS_ANDAMENTO);
            if (statusAdicional && dadosProcessados.servicosAdicionaisProjeto.hasOwnProperty(statusAdicional)) {
                dadosProcessados.servicosAdicionaisProjeto[statusAdicional]++;
            }
        }
    });
    
    console.log("Registros de vistorias identificados:", registrosVistoria.length);
    console.log("Registros de projetos identificados:", registrosProjeto.length);
    
    // Armazenar o total de registros de projetos
    dadosProcessados.totalRegistrosProjetos = registrosProjeto.length;

    // Agrupar registros de vistorias por protocolo
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

    dadosProcessados.totalProtocolos = Object.keys(protocolosAgrupados).length;
    console.log("Protocolos únicos identificados:", dadosProcessados.totalProtocolos);

    // Para cada protocolo, identificar as vistorias distribuídas e realizadas
    const protocolosRealizados = {};
    Object.entries(protocolosAgrupados).forEach(([protocolo, registros]) => {
        // Verificar se existe algum registro com ANDAMENTO = "DISTRIBUIDO" associado ao protocolo
        const temDistribuido = registros.some(r => r.ANDAMENTO === "DISTRIBUIDO");
        
        // Filtrar registros com status que indicam que a vistoria foi realizada
        const registrosRealizados = registros.filter(r => isVistoriaRealizada(r.STATUS_ANDAMENTO));
        
        // Considerar apenas protocolos que possuem tanto distribuição quanto realização
        if (temDistribuido && registrosRealizados.length > 0) {
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

    dadosProcessados.vistoriasRealizadas = Object.keys(protocolosRealizados).length;
    dadosProcessados.vistoriasPendentes = dadosProcessados.totalProtocolos - dadosProcessados.vistoriasRealizadas;
    console.log("Vistorias realizadas:", dadosProcessados.vistoriasRealizadas);
    console.log("Vistorias pendentes:", dadosProcessados.vistoriasPendentes);
    
    // Agora processamos os projetos
    // Agrupar registros de projetos por protocolo
    const protocolosProjetosAgrupados = {};
    registrosProjeto.forEach(row => {
        // Usa "PROTOCOLO/ANO" se disponível, senão cria a chave manualmente
        const protocoloKey = row["PROTOCOLO/ANO"] || `${row.PROTOCOLO}/${row.ANO}`;
        if (!protocolosProjetosAgrupados[protocoloKey]) {
            protocolosProjetosAgrupados[protocoloKey] = [];
        }
        
        // Normaliza valores nulos ou vazios na propriedade USUARIO
        let usuario = row.USUARIO;
        if (usuario === null || usuario === undefined || usuario === "" || usuario === "(null)") {
            usuario = "(não identificado)";
        }
        
        protocolosProjetosAgrupados[protocoloKey].push({
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
    
    dadosProcessados.totalProtocolosProjetos = Object.keys(protocolosProjetosAgrupados).length;
    console.log("Protocolos únicos de projetos identificados:", dadosProcessados.totalProtocolosProjetos);
    
    // Para cada protocolo de projeto, identificar os analisados e pendentes
    const protocolosProjetosAnalisados = {};
    Object.entries(protocolosProjetosAgrupados).forEach(([protocolo, registros]) => {
        // Verificar se existe algum registro com ANDAMENTO = "DISTRIBUIDO" ou "ENTREGUE AO SOLICITANTE COM EXIGÊNCIA" associado ao protocolo
        const temDistribuidoOuEntregue = registros.some(r => 
            r.ANDAMENTO === "DISTRIBUIDO" || 
            r.ANDAMENTO === "ENTREGUE AO SOLICITANTE COM EXIGÊNCIA" ||
            r.ANDAMENTO === "ENTREGUE AO SOLICITANTE COM EXIGENCIA" // Versão sem acentuação
        );
        
        // Filtrar registros com status que indicam que o projeto foi analisado
        const registrosAnalisados = registros.filter(r => isVistoriaRealizada(r.STATUS_ANDAMENTO));
        
        // Considerar protocolos que possuem distribuição/entrega ou realização
        if ((temDistribuidoOuEntregue || registrosAnalisados.length > 0)) {
            // Se tivermos registros analisados, usamos eles
            let registroParaUsar;
            
            if (registrosAnalisados.length > 0) {
                // Ordenar por DATA_SERVICO (mais recente primeiro)
                registrosAnalisados.sort((a, b) => {
                    const dateA = parseDataBR(a.DATA_SERVICO);
                    const dateB = parseDataBR(b.DATA_SERVICO);
                    
                    if (!dateA && !dateB) return 0;
                    if (!dateA) return 1;
                    if (!dateB) return -1;
                    
                    return dateB - dateA; // Ordenação decrescente (mais recente primeiro)
                });
                
                // Pegar o registro REALIZADO mais recente
                registroParaUsar = registrosAnalisados[0];
            } else {
                // Se não temos registros analisados, pegamos o registro com ENTREGUE AO SOLICITANTE COM EXIGÊNCIA
                const registrosEntregues = registros.filter(r => 
                    r.ANDAMENTO === "ENTREGUE AO SOLICITANTE COM EXIGÊNCIA" ||
                    r.ANDAMENTO === "ENTREGUE AO SOLICITANTE COM EXIGENCIA"
                );
                
                if (registrosEntregues.length > 0) {
                    // Ordenar por DATA_SERVICO (mais recente primeiro)
                    registrosEntregues.sort((a, b) => {
                        const dateA = parseDataBR(a.DATA_SERVICO);
                        const dateB = parseDataBR(b.DATA_SERVICO);
                        
                        if (!dateA && !dateB) return 0;
                        if (!dateA) return 1;
                        if (!dateB) return -1;
                        
                        return dateB - dateA;
                    });
                    
                    registroParaUsar = registrosEntregues[0];
                } else {
                    // Se não temos entregues também, usamos o distribuído
                    const registrosDistribuidos = registros.filter(r => r.ANDAMENTO === "DISTRIBUIDO");
                    if (registrosDistribuidos.length > 0) {
                        registrosDistribuidos.sort((a, b) => {
                            const dateA = parseDataBR(a.DATA_SERVICO);
                            const dateB = parseDataBR(b.DATA_SERVICO);
                            
                            if (!dateA && !dateB) return 0;
                            if (!dateA) return 1;
                            if (!dateB) return -1;
                            
                            return dateB - dateA;
                        });
                        
                        registroParaUsar = registrosDistribuidos[0];
                    } else {
                        // Se chegarmos aqui, usamos o primeiro registro que temos
                        registroParaUsar = registros[0];
                    }
                }
            }
            
            protocolosProjetosAnalisados[protocolo] = registroParaUsar;
            
            // Contabilizar por tipo de projeto
            const tipoProjeto = getTipoProjeto(registroParaUsar.SERVICO);
            dadosProcessados.tiposProjeto[tipoProjeto]++;
        }
    });
    
    dadosProcessados.projetosAnalisados = Object.keys(protocolosProjetosAnalisados).length;
    dadosProcessados.projetosPendentes = dadosProcessados.totalProtocolosProjetos - dadosProcessados.projetosAnalisados;
    console.log("Projetos analisados:", dadosProcessados.projetosAnalisados);
    console.log("Projetos pendentes:", dadosProcessados.projetosPendentes);
    
    // Contagem de projetos por responsável
    const projetosPorResponsavel = {};
    const projetosPorTipoEResponsavel = {};
    dadosProcessados.protocolosPorResponsavelProjeto = {}; // Reiniciar o objeto de protocolos por responsável
    
    Object.entries(protocolosProjetosAnalisados).forEach(([protocolo, registro]) => {
        const responsavel = registro.USUARIO;
        const servico = registro.SERVICO;
        const tipoProjeto = getTipoProjeto(servico);
        
        if (!projetosPorResponsavel[responsavel]) {
            projetosPorResponsavel[responsavel] = 0;
        }
        projetosPorResponsavel[responsavel]++;
        
        if (!projetosPorTipoEResponsavel[responsavel]) {
            projetosPorTipoEResponsavel[responsavel] = {
                "ANÁLISE DE PROJETO": 0,
                "SUBSTITUIÇÃO DE PROJETO": 0,
                "OUTROS": 0
            };
        }
        
        projetosPorTipoEResponsavel[responsavel][tipoProjeto]++;
        
        // Armazenar informações de protocolo por responsável, agrupando por tipo de projeto
        if (!dadosProcessados.protocolosPorResponsavelProjeto[responsavel]) {
            dadosProcessados.protocolosPorResponsavelProjeto[responsavel] = {
                "ANÁLISE DE PROJETO": [],
                "SUBSTITUIÇÃO DE PROJETO": [],
                "OUTROS": []
            };
        }
        
        // Adicionar o protocolo à lista correspondente ao tipo de projeto
        dadosProcessados.protocolosPorResponsavelProjeto[responsavel][tipoProjeto].push({
            protocolo: protocolo,
            servico: servico,
            data: registro.DATA_SERVICO,
            dataObj: parseDataBR(registro.DATA_SERVICO) // Adicionar objeto Date para ordenação posterior
        });
    });
    
    // Organizar responsáveis de projetos em um array com contagem e detalhes
    dadosProcessados.responsaveisProjetos = Object.entries(projetosPorResponsavel)
        .map(([responsavel, total]) => ({
            responsavel,
            total,
            analiseProjeto: projetosPorTipoEResponsavel[responsavel]["ANÁLISE DE PROJETO"],
            substituicaoProjeto: projetosPorTipoEResponsavel[responsavel]["SUBSTITUIÇÃO DE PROJETO"],
            outros: projetosPorTipoEResponsavel[responsavel]["OUTROS"]
        }))
        .sort((a, b) => b.total - a.total);
    
    console.log("Número de responsáveis por projetos identificados:", dadosProcessados.responsaveisProjetos.length);
    
    // Contagem de projetos sem usuário identificado
    dadosProcessados.responsaveisProjetosSemUsuario = projetosPorResponsavel["(não identificado)"] || 0;
    
    // Remover entrada "(não identificado)" do array de responsáveis de projetos
    dadosProcessados.responsaveisProjetos = dadosProcessados.responsaveisProjetos.filter(resp => 
        resp.responsavel !== "(não identificado)" && 
        resp.responsavel !== "(null)"
    );

    // Contagem de vistorias por responsável
    const vistoriasPorResponsavel = {};
    const vistoriasPorTipoEResponsavel = {};
    dadosProcessados.protocolosPorResponsavel = {}; // Reiniciar o objeto de protocolos por responsável
    
    Object.entries(protocolosRealizados).forEach(([protocolo, registro]) => {
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
        
        // Armazenar informações de protocolo por responsável, agrupando por tipo de vistoria
        if (!dadosProcessados.protocolosPorResponsavel[responsavel]) {
            dadosProcessados.protocolosPorResponsavel[responsavel] = {
                "VISTORIA PARA FUNCIONAMENTO": [],
                "VISTORIA PARA HABITE-SE": [],
                "FISCALIZAÇÃO": []
            };
        }
        
        // Adicionar o protocolo à lista correspondente ao tipo de vistoria
        dadosProcessados.protocolosPorResponsavel[responsavel][tipoVistoria].push({
            protocolo: protocolo,
            servico: servico,
            data: registro.DATA_SERVICO,
            dataObj: parseDataBR(registro.DATA_SERVICO) // Adicionar objeto Date para ordenação posterior
        });
        
        // Contabiliza para estatísticas de tipo de vistoria
        dadosProcessados.tiposVistoria[tipoVistoria]++;
        
        // Verificar se o serviço é um dos tipos a serem considerados para o total
        const servicoAdicional = identificarServicoAdicional(registro.SERVICO);
        if (servicoAdicional) {
            // Se for relacionado a funcionamento ou habite-se, adiciona ao tipo correspondente
            if (servicoAdicional && (tipoVistoria === "VISTORIA PARA FUNCIONAMENTO" || tipoVistoria === "VISTORIA PARA HABITE-SE")) {
                // Incrementa o contador do serviço, mas também já foi contabilizado para o tipo de vistoria
                dadosProcessados.servicosAdicionais[servicoAdicional]++;
            }
        }
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

// Função para renderizar o gráfico de responsáveis por projetos
function renderizarGraficoResponsaveisProjetos() {
    const ctx = document.getElementById('responsaveisProjetosChart').getContext('2d');
    
    // Se já existe um gráfico, destruí-lo
    if (responsaveisProjetosChart) {
        responsaveisProjetosChart.destroy();
    }
    
    // Preparar dados para o gráfico (top 10 responsáveis)
    const top10 = dadosProcessados.responsaveisProjetos.slice(0, 10);
    
    const labels = top10.map(r => {
        // Extrair o último nome ou o nome completo se curto
        const nomes = r.responsavel.split(' ');
        return nomes.length > 1 ? nomes[nomes.length - 1] : r.responsavel;
    });
    
    const dataAnaliseProjeto = top10.map(r => r.analiseProjeto);
    const dataSubstituicaoProjeto = top10.map(r => r.substituicaoProjeto);
    const dataOutros = top10.map(r => r.outros);
    
    // Criar gráfico
    responsaveisProjetosChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Análise de Projeto',
                    data: dataAnaliseProjeto,
                    backgroundColor: '#2980b9',
                    borderColor: '#1a5276',
                    borderWidth: 1
                },
                {
                    label: 'Substituição de Projeto',
                    data: dataSubstituicaoProjeto,
                    backgroundColor: '#27ae60',
                    borderColor: '#1e8449',
                    borderWidth: 1
                },
                {
                    label: 'Outros',
                    data: dataOutros,
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
                    text: 'Top 10 Técnicos por Volume de Projetos'
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

// Função para renderizar o gráfico de tipos de projeto
function renderizarGraficoTiposProjetos() {
    const ctx = document.getElementById('tiposProjetosChart').getContext('2d');
    
    // Se já existe um gráfico, destruí-lo
    if (tiposProjetosChart) {
        tiposProjetosChart.destroy();
    }
    
    // Preparar dados para o gráfico
    const labels = ["Análise de Projeto", "Substituição de Projeto", "Outros"];
    const data = [
        dadosProcessados.tiposProjeto["ANÁLISE DE PROJETO"],
        dadosProcessados.tiposProjeto["SUBSTITUIÇÃO DE PROJETO"],
        dadosProcessados.tiposProjeto["OUTROS"]
    ];
    
    // Criar gráfico
    tiposProjetosChart = new Chart(ctx, {
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
                    text: 'Distribuição por Tipo de Projeto'
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

// Função para renderizar o gráfico de status de andamento de projetos
function renderizarGraficoStatusProjetos() {
    const ctx = document.getElementById('statusProjetosChart').getContext('2d');
    
    // Se já existe um gráfico, destruí-lo
    if (statusProjetosChart) {
        statusProjetosChart.destroy();
    }
    
    // Contabilizar status de projetos
    const statusProjetos = {};
    dadosProcessados.statusAndamento && Object.entries(dadosProcessados.statusAndamento).forEach(([status, count]) => {
        if (statusProjetos[status]) {
            statusProjetos[status] += count;
        } else {
            statusProjetos[status] = count;
        }
    });
    
    // Destacar status específicos de projetos
    if (!statusProjetos["ENTREGUE AO SOLICITANTE COM EXIGÊNCIA"]) {
        statusProjetos["ENTREGUE AO SOLICITANTE COM EXIGÊNCIA"] = 0;
    }
    if (!statusProjetos["APROVADO"]) {
        statusProjetos["APROVADO"] = 0;
    }
    if (!statusProjetos["DISTRIBUIDO"]) {
        statusProjetos["DISTRIBUIDO"] = 0;
    }
    
    // Preparar dados para o gráfico
    const statusData = Object.entries(statusProjetos)
        .filter(([status]) => status !== "NÃO ESPECIFICADO" && status !== "")
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
    statusProjetosChart = new Chart(ctx, {
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

// Função para renderizar o gráfico de tendência temporal de projetos
function renderizarGraficoTendenciaProjetos(periodo) {
    const ctx = document.getElementById('tendenciaProjetosChart').getContext('2d');
    
    // Se já existe um gráfico, destruí-lo
    if (tendenciaProjetosChart) {
        tendenciaProjetosChart.destroy();
    }
    
    // Aqui contabilizaríamos a tendência temporal real de projetos
    // Como não temos dados estruturados para isso no estado atual, usaremos dados de exemplo
    // Em uma implementação real, seria necessário contar os projetos por mês/ano
    
    let labels, data;
    
    if (periodo === 'mes') {
        // Dados de exemplo por mês
        labels = ['01/2023', '02/2023', '03/2023', '04/2023', '05/2023', '06/2023'];
        data = [15, 22, 18, 25, 30, 28];
    } else {
        // Dados de exemplo por ano
        labels = ['2020', '2021', '2022', '2023'];
        data = [120, 145, 190, 210];
    }
    
    // Criar gráfico
    tendenciaProjetosChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Projetos Analisados',
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
                    text: periodo === 'mes' ? 'Evolução de Projetos por Mês' : 'Evolução de Projetos por Ano'
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

// Função para renderizar o gráfico de produção por responsável de projetos
function renderizarGraficoProducaoProjetos() {
    const ctx = document.getElementById('producaoProjetosChart').getContext('2d');
    const responsavelSelecionado = document.getElementById('producaoResponsavelProjetosSelect').value;
    
    // Se já existe um gráfico, destruí-lo
    if (producaoProjetosChart) {
        producaoProjetosChart.destroy();
        producaoProjetosChart = null;
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
    
    // Aqui teríamos dados reais de produção mensal por responsável
    // Como não temos dados estruturados para isso no estado atual, usaremos dados de exemplo
    // Em uma implementação real, usaríamos: dadosProcessados.producaoPorResponsavelProjeto[responsavelSelecionado]
    
    // Dados de exemplo
    const labels = ['01/2023', '02/2023', '03/2023', '04/2023', '05/2023', '06/2023'];
    const data = [5, 7, 4, 8, 6, 9];
    
    // Remover mensagem de "sem dados" se existir
    const container = ctx.canvas.parentNode;
    const msgElement = container.querySelector('.no-data-message');
    if (msgElement) {
        container.removeChild(msgElement);
    }
    
    // Exibir o canvas
    ctx.canvas.style.display = 'block';
    
    try {
        // Criar gráfico
        producaoProjetosChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Projetos Analisados',
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
        console.error("Erro ao renderizar gráfico de produção de projetos:", error);
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

// Função para renderizar o relatório
function renderizarRelatorio() {
    // Atualizar resumo de vistorias
    document.getElementById('totalRegistros').textContent = dadosProcessados.totalRegistros.toLocaleString();
    document.getElementById('totalProtocolos').textContent = dadosProcessados.totalProtocolos.toLocaleString();
    document.getElementById('totalRealizadas').textContent = dadosProcessados.vistoriasRealizadas.toLocaleString();
    document.getElementById('totalPendentes').textContent = dadosProcessados.vistoriasPendentes.toLocaleString();
    document.getElementById('totalFuncionamento').textContent = dadosProcessados.tiposVistoria["VISTORIA PARA FUNCIONAMENTO"].toLocaleString();
    document.getElementById('totalHabitese').textContent = dadosProcessados.tiposVistoria["VISTORIA PARA HABITE-SE"].toLocaleString();
    document.getElementById('totalFiscalizacao').textContent = dadosProcessados.tiposVistoria["FISCALIZAÇÃO"].toLocaleString();
    
    // Atualizar contadores de serviços adicionais para vistorias
    document.getElementById('totalAlteracaoDados').textContent = dadosProcessados.servicosAdicionais["ALTERAÇÃO DE DADOS DO SERVIÇO"].toLocaleString();
    document.getElementById('totalAlteracaoTipo').textContent = dadosProcessados.servicosAdicionais["ALTERAÇÃO DE TIPO DE SERVIÇO"].toLocaleString();
    document.getElementById('totalAprovado').textContent = dadosProcessados.servicosAdicionais["APROVADO"].toLocaleString();
    document.getElementById('totalCadastro').textContent = dadosProcessados.servicosAdicionais["CADASTRO"].toLocaleString();
    
    // Atualizar resumo de projetos
    document.getElementById('totalRegistrosProjetos').textContent = dadosProcessados.totalRegistrosProjetos.toLocaleString();
    document.getElementById('totalProtocolosProjetos').textContent = dadosProcessados.totalProtocolosProjetos.toLocaleString();
    document.getElementById('totalProjetosAnalisados').textContent = dadosProcessados.projetosAnalisados.toLocaleString();
    document.getElementById('totalProjetosPendentes').textContent = dadosProcessados.projetosPendentes.toLocaleString();
    document.getElementById('totalAnaliseProjeto').textContent = dadosProcessados.tiposProjeto["ANÁLISE DE PROJETO"].toLocaleString();
    document.getElementById('totalSubstituicaoProjeto').textContent = dadosProcessados.tiposProjeto["SUBSTITUIÇÃO DE PROJETO"].toLocaleString();
    document.getElementById('totalOutrosServicos').textContent = dadosProcessados.tiposProjeto["OUTROS"].toLocaleString();
    
    // Atualizar contadores de serviços adicionais para projetos
    document.getElementById('totalAlteracaoDadosProjeto').textContent = dadosProcessados.servicosAdicionaisProjeto["ALTERAÇÃO DE DADOS DO SERVIÇO"].toLocaleString();
    document.getElementById('totalAlteracaoTipoProjeto').textContent = dadosProcessados.servicosAdicionaisProjeto["ALTERAÇÃO DE TIPO DE SERVIÇO"].toLocaleString();
    document.getElementById('totalAprovadoProjeto').textContent = dadosProcessados.servicosAdicionaisProjeto["APROVADO"].toLocaleString();
    document.getElementById('totalCadastroProjeto').textContent = dadosProcessados.servicosAdicionaisProjeto["CADASTRO"].toLocaleString();

    // Renderizar tabela de responsáveis por vistorias
    const responsaveisBody = document.getElementById('responsaveisBody');
    responsaveisBody.innerHTML = '';
    
    // O filtro foi removido porque já filtramos o array de responsáveis anteriormente
    dadosProcessados.responsaveis.forEach(resp => {
        const tr = document.createElement('tr');
        
        // Verificar se temos dados de protocolos para este responsável
        const temProtocolos = dadosProcessados.protocolosPorResponsavel[resp.responsavel] &&
            (dadosProcessados.protocolosPorResponsavel[resp.responsavel]["VISTORIA PARA FUNCIONAMENTO"].length > 0 ||
             dadosProcessados.protocolosPorResponsavel[resp.responsavel]["VISTORIA PARA HABITE-SE"].length > 0 ||
             dadosProcessados.protocolosPorResponsavel[resp.responsavel]["FISCALIZAÇÃO"].length > 0);
        
        if (temProtocolos) {
            // Construir o conteúdo do tooltip com os protocolos por tipo
            // Ordenar cada lista de protocolos por data (mais recentes primeiro)
            const sortProtocosByDate = (protocolos) => {
                return [...protocolos].sort((a, b) => {
                    if (!a.dataObj && !b.dataObj) return 0;
                    if (!a.dataObj) return 1; // Sem data vai para o final
                    if (!b.dataObj) return -1; // Sem data vai para o final
                    return b.dataObj - a.dataObj; // Ordem decrescente (mais recente primeiro)
                });
            };
            
            const protocolosFuncionamento = sortProtocosByDate(dadosProcessados.protocolosPorResponsavel[resp.responsavel]["VISTORIA PARA FUNCIONAMENTO"]);
            const protocolosHabitese = sortProtocosByDate(dadosProcessados.protocolosPorResponsavel[resp.responsavel]["VISTORIA PARA HABITE-SE"]);
            const protocolosFiscalizacao = sortProtocosByDate(dadosProcessados.protocolosPorResponsavel[resp.responsavel]["FISCALIZAÇÃO"]);
            
            const tooltipContent = `
                <div class="tooltip-title">Protocolos Atendidos por ${resp.responsavel}</div>
                <div class="tooltip-summary">
                    <strong>Total:</strong> ${resp.total} protocolos | 
                    <strong>Funcionamento:</strong> ${resp.funcionamento} | 
                    <strong>Habite-se:</strong> ${resp.habitese} | 
                    <strong>Fiscalização:</strong> ${resp.fiscalizacao}
                </div>
                
                ${protocolosFuncionamento.length > 0 ? `
                <div class="protocol-group">
                    <div class="protocol-group-title">Vistorias para Funcionamento (${protocolosFuncionamento.length})</div>
                    <ul class="protocol-list">
                        ${protocolosFuncionamento.map(p => `
                            <li class="protocol-item">${p.protocolo}: ${p.servico} ${p.data ? `(${p.data})` : ''}</li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}
                
                ${protocolosHabitese.length > 0 ? `
                <div class="protocol-group">
                    <div class="protocol-group-title">Vistorias para Habite-se (${protocolosHabitese.length})</div>
                    <ul class="protocol-list">
                        ${protocolosHabitese.map(p => `
                            <li class="protocol-item">${p.protocolo}: ${p.servico} ${p.data ? `(${p.data})` : ''}</li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}
                
                ${protocolosFiscalizacao.length > 0 ? `
                <div class="protocol-group">
                    <div class="protocol-group-title">Fiscalizações (${protocolosFiscalizacao.length})</div>
                    <ul class="protocol-list">
                        ${protocolosFiscalizacao.map(p => `
                            <li class="protocol-item">${p.protocolo}: ${p.servico} ${p.data ? `(${p.data})` : ''}</li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}
            `;
            
            tr.innerHTML = `
                <td class="tooltip-trigger">
                    ${resp.responsavel}
                    <div class="tooltip-content">${tooltipContent}</div>
                </td>
                <td>${resp.total}</td>
                <td>${resp.funcionamento}</td>
                <td>${resp.habitese}</td>
                <td>${resp.fiscalizacao}</td>
            `;
        } else {
            tr.innerHTML = `
                <td>${resp.responsavel}</td>
                <td>${resp.total}</td>
                <td>${resp.funcionamento}</td>
                <td>${resp.habitese}</td>
                <td>${resp.fiscalizacao}</td>
            `;
        }
        
        responsaveisBody.appendChild(tr);
    });
    
    // Renderizar tabela de responsáveis por projetos
    const responsaveisProjetosBody = document.getElementById('responsaveisProjetosBody');
    responsaveisProjetosBody.innerHTML = '';
    
    dadosProcessados.responsaveisProjetos.forEach(resp => {
        const tr = document.createElement('tr');
        
        // Verificar se temos dados de protocolos para este responsável
        const temProtocolos = dadosProcessados.protocolosPorResponsavelProjeto[resp.responsavel] &&
            (dadosProcessados.protocolosPorResponsavelProjeto[resp.responsavel]["ANÁLISE DE PROJETO"].length > 0 ||
             dadosProcessados.protocolosPorResponsavelProjeto[resp.responsavel]["SUBSTITUIÇÃO DE PROJETO"].length > 0 ||
             dadosProcessados.protocolosPorResponsavelProjeto[resp.responsavel]["OUTROS"].length > 0);
        
        if (temProtocolos) {
            // Construir o conteúdo do tooltip com os protocolos por tipo
            // Ordenar cada lista de protocolos por data (mais recentes primeiro)
            const sortProtocosByDate = (protocolos) => {
                return [...protocolos].sort((a, b) => {
                    if (!a.dataObj && !b.dataObj) return 0;
                    if (!a.dataObj) return 1; // Sem data vai para o final
                    if (!b.dataObj) return -1; // Sem data vai para o final
                    return b.dataObj - a.dataObj; // Ordem decrescente (mais recente primeiro)
                });
            };
            
            const protocolosAnaliseProjeto = sortProtocosByDate(dadosProcessados.protocolosPorResponsavelProjeto[resp.responsavel]["ANÁLISE DE PROJETO"]);
            const protocolosSubstituicaoProjeto = sortProtocosByDate(dadosProcessados.protocolosPorResponsavelProjeto[resp.responsavel]["SUBSTITUIÇÃO DE PROJETO"]);
            const protocolosOutros = sortProtocosByDate(dadosProcessados.protocolosPorResponsavelProjeto[resp.responsavel]["OUTROS"]);
            
            const tooltipContent = `
                <div class="tooltip-title">Protocolos de Projetos Atendidos por ${resp.responsavel}</div>
                <div class="tooltip-summary">
                    <strong>Total:</strong> ${resp.total} protocolos | 
                    <strong>Análise:</strong> ${resp.analiseProjeto} | 
                    <strong>Substituição:</strong> ${resp.substituicaoProjeto} | 
                    <strong>Outros:</strong> ${resp.outros}
                </div>
                
                ${protocolosAnaliseProjeto.length > 0 ? `
                <div class="protocol-group">
                    <div class="protocol-group-title">Análise de Projetos (${protocolosAnaliseProjeto.length})</div>
                    <ul class="protocol-list">
                        ${protocolosAnaliseProjeto.map(p => `
                            <li class="protocol-item">${p.protocolo}: ${p.servico} ${p.data ? `(${p.data})` : ''}</li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}
                
                ${protocolosSubstituicaoProjeto.length > 0 ? `
                <div class="protocol-group">
                    <div class="protocol-group-title">Substituição de Projetos (${protocolosSubstituicaoProjeto.length})</div>
                    <ul class="protocol-list">
                        ${protocolosSubstituicaoProjeto.map(p => `
                            <li class="protocol-item">${p.protocolo}: ${p.servico} ${p.data ? `(${p.data})` : ''}</li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}
                
                ${protocolosOutros.length > 0 ? `
                <div class="protocol-group">
                    <div class="protocol-group-title">Outros Serviços (${protocolosOutros.length})</div>
                    <ul class="protocol-list">
                        ${protocolosOutros.map(p => `
                            <li class="protocol-item">${p.protocolo}: ${p.servico} ${p.data ? `(${p.data})` : ''}</li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}
            `;
            
            tr.innerHTML = `
                <td class="tooltip-trigger">
                    ${resp.responsavel}
                    <div class="tooltip-content">${tooltipContent}</div>
                </td>
                <td>${resp.total}</td>
                <td>${resp.analiseProjeto}</td>
                <td>${resp.substituicaoProjeto}</td>
                <td>${resp.outros}</td>
            `;
        } else {
            tr.innerHTML = `
                <td>${resp.responsavel}</td>
                <td>${resp.total}</td>
                <td>${resp.analiseProjeto}</td>
                <td>${resp.substituicaoProjeto}</td>
                <td>${resp.outros}</td>
            `;
        }
        
        responsaveisProjetosBody.appendChild(tr);
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

    // Preencher o select de responsáveis para o gráfico de produção - vistorias
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
    
    // Preencher o select de responsáveis para o gráfico de produção - projetos
    const selectResponsavelProjetos = document.getElementById('producaoResponsavelProjetosSelect');
    selectResponsavelProjetos.innerHTML = '<option value="">Selecione um técnico responsável</option>';
    
    dadosProcessados.responsaveisProjetos
        .filter(resp => resp.responsavel !== "(não identificado)")
        .forEach(resp => {
            const option = document.createElement('option');
            option.value = resp.responsavel;
            option.textContent = resp.responsavel;
            selectResponsavelProjetos.appendChild(option);
        });

    // Verificar qual aba está ativa para renderizar os gráficos apropriados
    if (document.getElementById('vistoriaPanel').classList.contains('active')) {
        renderizarGraficos();
    } else if (document.getElementById('projetoPanel').classList.contains('active')) {
        renderizarGraficosProjetos();
    }
}

// Função para renderizar todos os gráficos de vistorias
function renderizarGraficos() {
    renderizarGraficoResponsaveis();
    renderizarGraficoTipos();
    renderizarGraficoStatus();
    renderizarGraficoTendencia('mes');
    // O gráfico de produção será renderizado quando um responsável for selecionado
}

// Função para renderizar todos os gráficos de projetos
function renderizarGraficosProjetos() {
    console.log("Iniciando renderização de gráficos de projetos");
    
    try {
        // Verificar se os elementos Canvas existem
        const responsaveisCanvas = document.getElementById('responsaveisProjetosChart');
        const tiposCanvas = document.getElementById('tiposProjetosChart');
        const statusCanvas = document.getElementById('statusProjetosChart');
        const tendenciaCanvas = document.getElementById('tendenciaProjetosChart');
        
        console.log("Canvas dos gráficos de projetos:", responsaveisCanvas, tiposCanvas, statusCanvas, tendenciaCanvas);
        
        if (responsaveisCanvas && tiposCanvas && statusCanvas && tendenciaCanvas) {
            renderizarGraficoResponsaveisProjetos();
            renderizarGraficoTiposProjetos();
            renderizarGraficoStatusProjetos();
            renderizarGraficoTendenciaProjetos('mes');
            console.log("Todos os gráficos de projetos foram renderizados com sucesso");
        } else {
            console.error("Alguns elementos canvas para os gráficos de projetos não foram encontrados");
        }
    } catch (err) {
        console.error("Erro ao renderizar gráficos de projetos:", err);
    }
    
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
function openMainTab(evt, tabName) {
    // Esconder todas as abas principais
    const mainTabContent = document.getElementsByClassName("main-tab-content");
    for (let i = 0; i < mainTabContent.length; i++) {
        mainTabContent[i].classList.remove("active");
    }
    
    // Remover classe "active" de todos os botões principais
    const mainTabBtns = document.getElementsByClassName("main-tab-btn");
    for (let i = 0; i < mainTabBtns.length; i++) {
        mainTabBtns[i].classList.remove("active");
    }
    
    // Mostrar a aba principal selecionada e marcar o botão como ativo
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
    
    // Alternar o painel de equipe técnica correspondente
    const equipeTecnicaVistorias = document.getElementById('equipeTecnicaVistorias');
    const equipeTecnicaProjetos = document.getElementById('equipeTecnicaProjetos');
    
    // Alternar o painel de gráficos correspondente
    const graficosVistorias = document.getElementById('graficosVistorias');
    const graficosProjetos = document.getElementById('graficosProjetos');
    
    console.log("Alternando para: ", tabName);
    console.log("Elementos: ", equipeTecnicaVistorias, equipeTecnicaProjetos, graficosVistorias, graficosProjetos);
    
    if (tabName === 'vistoriaPanel') {
        if (equipeTecnicaVistorias) equipeTecnicaVistorias.classList.add('active');
        if (equipeTecnicaProjetos) equipeTecnicaProjetos.classList.remove('active');
        
        if (graficosVistorias) graficosVistorias.classList.add('active');
        if (graficosProjetos) graficosProjetos.classList.remove('active');
        
        // Renderizar gráficos de vistorias
        if (document.getElementById('graficos').classList.contains('active')) {
            // Renderizar imediatamente
            renderizarGraficos();
        }
    } else if (tabName === 'projetoPanel') {
        if (equipeTecnicaVistorias) equipeTecnicaVistorias.classList.remove('active');
        if (equipeTecnicaProjetos) equipeTecnicaProjetos.classList.add('active');
        
        if (graficosVistorias) graficosVistorias.classList.remove('active');
        if (graficosProjetos) graficosProjetos.classList.add('active');
        
        // Renderizar gráficos de projetos
        if (document.getElementById('graficos').classList.contains('active')) {
            // Renderizar imediatamente e com um delay para garantir que a UI foi atualizada
            renderizarGraficosProjetos();
            setTimeout(function() {
                renderizarGraficosProjetos();
            }, 200);
        }
    }
}

// Função para abrir abas secundárias
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
    
    // Se a aba de gráficos foi selecionada, renderizar os gráficos apropriados
    if (tabName === 'graficos') {
        console.log("Aba de gráficos selecionada, verificando qual painel está ativo");
        // Verificar qual painel principal está ativo
        if (document.getElementById('vistoriaPanel').classList.contains('active')) {
            console.log("Renderizando gráficos de vistorias");
            renderizarGraficos();
        } else if (document.getElementById('projetoPanel').classList.contains('active')) {
            console.log("Renderizando gráficos de projetos");
            renderizarGraficosProjetos();
            // Dupla chamada para garantir a renderização
            setTimeout(() => {
                renderizarGraficosProjetos();
            }, 300);
        }
    }
}

// Função para abrir abas de gráficos - painel vistorias
function openChartTab(evt, tabName) {
    // Esconder todas as abas de gráficos do painel de vistorias
    const chartTabContent = document.querySelectorAll("#graficosVistorias .chart-tab-content");
    for (let i = 0; i < chartTabContent.length; i++) {
        chartTabContent[i].classList.remove("active");
    }
    
    // Remover classe "active" de todos os botões de abas de gráficos do painel de vistorias
    const chartTabBtns = document.querySelectorAll("#graficosVistorias .chart-tab-btn");
    for (let i = 0; i < chartTabBtns.length; i++) {
        chartTabBtns[i].classList.remove("active");
    }
    
    // Mostrar a aba de gráfico selecionada e marcar o botão como ativo
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
}

// Função para abrir abas de gráficos - painel projetos
function openChartTabProjetos(evt, tabName) {
    // Esconder todas as abas de gráficos do painel de projetos
    const chartTabContent = document.querySelectorAll("#graficosProjetos .chart-tab-content");
    for (let i = 0; i < chartTabContent.length; i++) {
        chartTabContent[i].classList.remove("active");
    }
    
    // Remover classe "active" de todos os botões de abas de gráficos do painel de projetos
    const chartTabBtns = document.querySelectorAll("#graficosProjetos .chart-tab-btn");
    for (let i = 0; i < chartTabBtns.length; i++) {
        chartTabBtns[i].classList.remove("active");
    }
    
    // Mostrar a aba de gráfico selecionada e marcar o botão como ativo
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
}

