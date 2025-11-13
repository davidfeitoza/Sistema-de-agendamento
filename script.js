// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD2ZHzDzfb77UoaI0NO6cREbSZAyj95yiU",
  authDomain: "crud-em-javascript.firebaseapp.com",
  databaseURL: "https://crud-em-javascript-default-rtdb.firebaseio.com",
  projectId: "crud-em-javascript",
  storageBucket: "crud-em-javascript.firebasestorage.app",
  messagingSenderId: "607893994208",
  appId: "1:607893994208:web:4c56ab67dd17062bcbae85",
  measurementId: "G-7H8KKJDWDX"
};

// Inicializar Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();

console.log("🏢 Sistema Corporativo de Agendamentos Iniciado!");

// Variáveis globais
let usuarioAtual = null;
let reuniaoSelecionada = null;
const reunioesRef = database.ref('reunioes');
const funcionariosRef = database.ref('funcionarios');
const clientesRef = database.ref('clientes');

// Elementos da UI
const dashboard = document.getElementById('dashboard');
const funcionarioView = document.getElementById('funcionario-view');
const clienteView = document.getElementById('cliente-view');
const adminView = document.getElementById('admin-view');

// Configurar data mínima para hoje
document.getElementById('data-reuniao').min = new Date().toISOString().split('T')[0];

// Sistema de Login
function fazerLogin() {
    const tipoUsuario = document.getElementById('tipo-usuario').value;
    const email = document.getElementById('user-email').value.trim();
    
    if (!tipoUsuario || !email) {
        alert("Por favor, selecione o tipo de usuário e informe seu e-mail!");
        return;
    }
    
    usuarioAtual = { tipo: tipoUsuario, email: email };
    
    // Mostrar dashboard e view apropriada
    dashboard.classList.remove('hidden');
    document.getElementById('funcionario-view').classList.add('hidden');
    document.getElementById('cliente-view').classList.add('hidden');
    document.getElementById('admin-view').classList.add('hidden');
    
    if (tipoUsuario === 'funcionario') {
        funcionarioView.classList.remove('hidden');
        carregarDashboardFuncionario();
    } else if (tipoUsuario === 'cliente') {
        clienteView.classList.remove('hidden');
        document.getElementById('nome-cliente').textContent = email.split('@')[0];
        carregarReunioesCliente();
    } else if (tipoUsuario === 'admin') {
        adminView.classList.remove('hidden');
        carregarDashboardAdmin();
    }
    
    console.log(`✅ Usuário logado: ${email} (${tipoUsuario})`);
}

// Funções do Funcionário
function carregarDashboardFuncionario() {
    reunioesRef.on('value', (snapshot) => {
        const reunioes = snapshot.val();
        let reunioesHoje = 0;
        let reunioesSemana = 0;
        let reunioesPendentes = 0;
        
        if (reunioes) {
            const hoje = new Date().toISOString().split('T')[0];
            const umaSemana = new Date();
            umaSemana.setDate(umaSemana.getDate() + 7);
            const fimSemana = umaSemana.toISOString().split('T')[0];
            
            Object.values(reunioes).forEach(reuniao => {
                if (reuniao.funcionario === usuarioAtual.email) {
                    if (reuniao.data === hoje) reunioesHoje++;
                    if (reuniao.data >= hoje && reuniao.data <= fimSemana) reunioesSemana++;
                    if (reuniao.status === 'pendente') reunioesPendentes++;
                }
            });
        }
        
        document.getElementById('reunioes-hoje').textContent = reunioesHoje;
        document.getElementById('reunioes-semana').textContent = reunioesSemana;
        document.getElementById('reunioes-pendentes').textContent = reunioesPendentes;
        
        carregarReunioesFuncionario();
    });
}

// Formulário de Nova Reunião
document.getElementById('form-reuniao').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const clienteEmail = document.getElementById('cliente-email').value.trim();
    const clienteNome = document.getElementById('cliente-nome').value.trim();
    const tipoReuniao = document.getElementById('tipo-reuniao').value;
    const duracao = document.getElementById('duracao').value;
    const data = document.getElementById('data-reuniao').value;
    const hora = document.getElementById('hora-reuniao').value;
    const local = document.getElementById('local-reuniao').value;
    const link = document.getElementById('link-reuniao').value.trim();
    const pauta = document.getElementById('pauta').value.trim();
    
    // Validações
    if (!clienteEmail || !clienteNome || !tipoReuniao || !data || !hora || !local || !pauta) {
        alert("Por favor, preencha todos os campos obrigatórios!");
        return;
    }
    
    // Verificar conflito de horário
    const dataHoraReuniao = new Date(data + 'T' + hora);
    if (dataHoraReuniao < new Date()) {
        alert("Não é possível agendar reuniões no passado!");
        return;
    }
    
    console.log("💼 Criando nova reunião...");
    
    // Salvar no Firebase
    const novaReuniao = reunioesRef.push();
    novaReuniao.set({
        id: novaReuniao.key,
        clienteEmail: clienteEmail,
        clienteNome: clienteNome,
        funcionario: usuarioAtual.email,
        tipo: tipoReuniao,
        duracao: duracao,
        data: data,
        hora: hora,
        local: local,
        link: link,
        pauta: pauta,
        status: 'pendente',
        confirmacaoCliente: 'pendente',
        timestamp: new Date().toISOString()
    })
    .then(() => {
        console.log("✅ Convite de reunião enviado com sucesso!");
        alert("Convite de reunião enviado com sucesso! ✅");
        document.getElementById('form-reuniao').reset();
        
        // Simular envio de e-mail
        simularEnvioEmail(clienteEmail, data, hora, local);
    })
    .catch((error) => {
        console.error("❌ Erro ao agendar reunião:", error);
        alert("Erro ao agendar reunião: " + error.message);
    });
});

function carregarReunioesFuncionario() {
    reunioesRef.on('value', (snapshot) => {
        const reunioes = snapshot.val();
        const lista = document.getElementById('lista-reunioes-funcionario');
        const filtroStatus = document.getElementById('filtro-status').value;
        const filtroData = document.getElementById('filtro-data').value;
        
        if (reunioes) {
            let reunioesFiltradas = Object.entries(reunioes)
                .filter(([id, reuniao]) => reuniao.funcionario === usuarioAtual.email);
            
            // Aplicar filtros
            if (filtroStatus) {
                reunioesFiltradas = reunioesFiltradas.filter(([id, reuniao]) => 
                    reuniao.status === filtroStatus
                );
            }
            
            if (filtroData) {
                reunioesFiltradas = reunioesFiltradas.filter(([id, reuniao]) => 
                    reuniao.data === filtroData
                );
            }
            
            // Ordenar por data e hora
            reunioesFiltradas.sort((a, b) => {
                const dataA = new Date(a[1].data + 'T' + a[1].hora);
                const dataB = new Date(b[1].data + 'T' + b[1].hora);
                return dataA - dataB;
            });
            
            if (reunioesFiltradas.length > 0) {
                let html = '';
                reunioesFiltradas.forEach(([id, reuniao]) => {
                    const dataFormatada = formatarData(reuniao.data);
                    const statusClass = `status-${reuniao.status}`;
                    
                    html += `
                        <div class="reuniao-item ${reuniao.status}">
                            <div class="reuniao-info">
                                <h4>👤 ${reuniao.clienteNome}</h4>
                                <p>📧 ${reuniao.clienteEmail}</p>
                                <p>📅 ${dataFormatada} às ${reuniao.hora}</p>
                                <p>📍 ${reuniao.local}</p>
                                <p>📋 ${reuniao.pauta}</p>
                                <span class="status-badge ${statusClass}">
                                    ${reuniao.status} • ${reuniao.confirmacaoCliente}
                                </span>
                            </div>
                            <div class="reuniao-acoes">
                                ${reuniao.status === 'pendente' ? `
                                    <button class="btn-success" onclick="marcarConcluida('${id}')">✅ Concluir</button>
                                    <button class="btn-danger" onclick="cancelarReuniao('${id}')">❌ Cancelar</button>
                                ` : ''}
                                ${reuniao.status === 'confirmada' ? `
                                    <button class="btn-success" onclick="marcarConcluida('${id}')">✅ Concluir</button>
                                    <button class="btn-danger" onclick="cancelarReuniao('${id}')">❌ Cancelar</button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                });
                lista.innerHTML = html;
            } else {
                lista.innerHTML = '<p class="vazio">Nenhuma reunião encontrada com os filtros selecionados</p>';
            }
        } else {
            lista.innerHTML = '<p class="vazio">Nenhuma reunião agendada ainda</p>';
        }
    });
}

// Funções do Cliente
function carregarReunioesCliente() {
    reunioesRef.on('value', (snapshot) => {
        const reunioes = snapshot.val();
        const lista = document.getElementById('lista-reunioes-cliente');
        
        if (reunioes) {
            const reunioesCliente = Object.entries(reunioes)
                .filter(([id, reuniao]) => reuniao.clienteEmail === usuarioAtual.email)
                .sort((a, b) => {
                    const dataA = new Date(a[1].data + 'T' + a[1].hora);
                    const dataB = new Date(b[1].data + 'T' + b[1].hora);
                    return dataA - dataB;
                });
            
            if (reunioesCliente.length > 0) {
                let html = '';
                reunioesCliente.forEach(([id, reuniao]) => {
                    const dataFormatada = formatarData(reuniao.data);
                    const statusClass = `status-${reuniao.status}`;
                    
                    html += `
                        <div class="reuniao-item ${reuniao.status}">
                            <div class="reuniao-info">
                                <h4>💼 ${reuniao.tipo}</h4>
                                <p>👤 Com: ${reuniao.funcionario}</p>
                                <p>📅 ${dataFormatada} às ${reuniao.hora}</p>
                                <p>📍 ${reuniao.local}</p>
                                <p>📋 ${reuniao.pauta}</p>
                                <span class="status-badge ${statusClass}">
                                    ${reuniao.status} • ${reuniao.confirmacaoCliente}
                                </span>
                            </div>
                            <div class="reuniao-acoes">
                                ${reuniao.confirmacaoCliente === 'pendente' ? `
                                    <button class="btn-primary" onclick="abrirModalConfirmacao('${id}')">
                                        Responder Convite
                                    </button>
                                ` : ''}
                                ${reuniao.link ? `
                                    <button class="btn-success" onclick="window.open('${reuniao.link}', '_blank')">
                                        🔗 Acessar Reunião
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                });
                lista.innerHTML = html;
            } else {
                lista.innerHTML = '<p class="vazio">Nenhuma reunião agendada para você</p>';
            }
        } else {
            lista.innerHTML = '<p class="vazio">Nenhuma reunião agendada para você</p>';
        }
    });
}

// Modal de Confirmação do Cliente
function abrirModalConfirmacao(reuniaoId) {
    reuniaoSelecionada = reuniaoId;
    reunioesRef.child(reuniaoId).once('value', (snapshot) => {
        const reuniao = snapshot.val();
        const dataFormatada = formatarData(reuniao.data);
        
        document.getElementById('detalhes-reuniao').innerHTML = `
            <p><strong>Funcionário:</strong> ${reuniao.funcionario}</p>
            <p><strong>Data:</strong> ${dataFormatada}</p>
            <p><strong>Hora:</strong> ${reuniao.hora}</p>
            <p><strong>Local:</strong> ${reuniao.local}</p>
            <p><strong>Duração:</strong> ${reuniao.duracao} minutos</p>
            <p><strong>Pauta:</strong> ${reuniao.pauta}</p>
        `;
        
        document.getElementById('modal-confirmacao').style.display = 'flex';
    });
}

function confirmarReuniao() {
    if (reuniaoSelecionada) {
        reunioesRef.child(reuniaoSelecionada).update({
            confirmacaoCliente: 'confirmada',
            status: 'confirmada'
        })
        .then(() => {
            alert("Reunião confirmada com sucesso! ✅");
            fecharModalConfirmacao();
            
            // Simular envio de notificação para o funcionário
            simularNotificacaoFuncionario(reuniaoSelecionada);
        })
        .catch((error) => {
            alert("Erro ao confirmar reunião: " + error.message);
        });
    }
}

function recusarReuniao() {
    if (reuniaoSelecionada) {
        reunioesRef.child(reuniaoSelecionada).update({
            confirmacaoCliente: 'recusada',
            status: 'cancelada'
        })
        .then(() => {
            alert("Reunião recusada.");
            fecharModalConfirmacao();
        })
        .catch((error) => {
            alert("Erro ao recusar reunião: " + error.message);
        });
    }
}

function proporNovoHorario() {
    fecharModalConfirmacao();
    document.getElementById('modal-novo-horario').style.display = 'flex';
}

function enviarProposta() {
    const novaData = document.getElementById('nova-data').value;
    const novaHora = document.getElementById('nova-hora').value;
    
    if (!novaData || !novaHora) {
        alert("Por favor, selecione nova data e hora!");
        return;
    }
    
    if (reuniaoSelecionada) {
        reunioesRef.child(reuniaoSelecionada).update({
            confirmacaoCliente: 'proposta_alteracao',
            propostaData: novaData,
            propostaHora: novaHora
        })
        .then(() => {
            alert("Proposta de novo horário enviada! Aguarde a confirmação do funcionário.");
            fecharModalHorario();
            
            // Simular notificação para o funcionário
            simularNotificacaoProposta(reuniaoSelecionada, novaData, novaHora);
        })
        .catch((error) => {
            alert("Erro ao enviar proposta: " + error.message);
        });
    }
}

// Funções do Administrador
function carregarDashboardAdmin() {
    // Carregar estatísticas
    reunioesRef.on('value', (snapshot) => {
        const reunioes = snapshot.val();
        let total = 0;
        let confirmadas = 0;
        
        if (reunioes) {
            total = Object.keys(reunioes).length;
            confirmadas = Object.values(reunioes).filter(r => r.status === 'confirmada').length;
        }
        
        document.getElementById('total-reunioes').textContent = total;
        document.getElementById('taxa-confirmacao').textContent = 
            total > 0 ? Math.round((confirmadas / total) * 100) + '%' : '0%';
    });
    
    // Carregar funcionários
    funcionariosRef.on('value', (snapshot) => {
        const funcionarios = snapshot.val();
        const lista = document.getElementById('lista-funcionarios');
        
        if (funcionarios) {
            let html = '<h4>Funcionários Cadastrados:</h4>';
            Object.entries(funcionarios).forEach(([id, func]) => {
                html += `
                    <div class="reuniao-item">
                        <div class="reuniao-info">
                            <p><strong>${func.nome}</strong> - ${func.email}</p>
                        </div>
                        <div class="reuniao-acoes">
                            <button class="btn-danger" onclick="removerFuncionario('${id}')">
                                Remover
                            </button>
                        </div>
                    </div>
                `;
            });
            lista.innerHTML = html;
            document.getElementById('funcionarios-ativos').textContent = Object.keys(funcionarios).length;
        } else {
            lista.innerHTML = '<p class="vazio">Nenhum funcionário cadastrado</p>';
            document.getElementById('funcionarios-ativos').textContent = '0';
        }
    });
}

function adicionarFuncionario() {
    const nome = document.getElementById('novo-funcionario').value.trim();
    const email = document.getElementById('email-funcionario').value.trim();
    
    if (!nome || !email) {
        alert("Por favor, preencha nome e e-mail do funcionário!");
        return;
    }
    
    funcionariosRef.push().set({
        nome: nome,
        email: email,
        timestamp: new Date().toISOString()
    })
    .then(() => {
        alert("Funcionário adicionado com sucesso!");
        document.getElementById('novo-funcionario').value = '';
        document.getElementById('email-funcionario').value = '';
    })
    .catch((error) => {
        alert("Erro ao adicionar funcionário: " + error.message);
    });
}

function removerFuncionario(id) {
    if (confirm("Tem certeza que deseja remover este funcionário?")) {
        funcionariosRef.child(id).remove()
        .then(() => {
            alert("Funcionário removido com sucesso!");
        })
        .catch((error) => {
            alert("Erro ao remover funcionário: " + error.message);
        });
    }
}

function gerarRelatorio() {
    const dataInicio = document.getElementById('data-inicio').value;
    const dataFim = document.getElementById('data-fim').value;
    
    if (!dataInicio || !dataFim) {
        alert("Por favor, selecione as datas de início e fim!");
        return;
    }
    
    reunioesRef.once('value', (snapshot) => {
        const reunioes = snapshot.val();
        const relatorio = document.getElementById('relatorio-admin');
        
        if (reunioes) {
            const reunioesFiltradas = Object.values(reunioes).filter(reuniao => 
                reuniao.data >= dataInicio && reuniao.data <= dataFim
            );
            
            const stats = {
                total: reunioesFiltradas.length,
                confirmadas: reunioesFiltradas.filter(r => r.status === 'confirmada').length,
                canceladas: reunioesFiltradas.filter(r => r.status === 'cancelada').length,
                concluidas: reunioesFiltradas.filter(r => r.status === 'concluida').length
            };
            
            relatorio.innerHTML = `
                <h4>Relatório: ${dataInicio} a ${dataFim}</h4>
                <div class="stats">
                    <div class="stat-card">
                        <h3>Total</h3>
                        <span>${stats.total}</span>
                    </div>
                    <div class="stat-card">
                        <h3>Confirmadas</h3>
                        <span>${stats.confirmadas}</span>
                    </div>
                    <div class="stat-card">
                        <h3>Canceladas</h3>
                        <span>${stats.canceladas}</span>
                    </div>
                    <div class="stat-card">
                        <h3>Concluídas</h3>
                        <span>${stats.concluidas}</span>
                    </div>
                </div>
            `;
        } else {
            relatorio.innerHTML = '<p class="vazio">Nenhuma reunião no período selecionado</p>';
        }
    });
}

// Funções Auxiliares
function formatarData(data) {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
}

function aplicarFiltros() {
    carregarReunioesFuncionario();
}

function exportarRelatorio() {
    alert("Funcionalidade de exportação ativada! Em produção, isso geraria um arquivo Excel/PDF.");
    // Em uma implementação real, aqui geraria um relatório para download
}

function marcarConcluida(reuniaoId) {
    reunioesRef.child(reuniaoId).update({
        status: 'concluida'
    })
    .then(() => {
        alert("Reunião marcada como concluída!");
    })
    .catch((error) => {
        alert("Erro ao marcar reunião como concluída: " + error.message);
    });
}

function cancelarReuniao(reuniaoId) {
    if (confirm("Tem certeza que deseja cancelar esta reunião?")) {
        reunioesRef.child(reuniaoId).update({
            status: 'cancelada',
            confirmacaoCliente: 'cancelada'
        })
        .then(() => {
            alert("Reunião cancelada!");
        })
        .catch((error) => {
            alert("Erro ao cancelar reunião: " + error.message);
        });
    }
}

// Funções de Simulação (para demonstração)
function simularEnvioEmail(email, data, hora, local) {
    console.log(`📧 E-mail simulado enviado para: ${email}`);
    console.log(`Assunto: Convite para reunião em ${data} às ${hora}`);
    console.log(`Local: ${local}`);
}

function simularNotificacaoFuncionario(reuniaoId) {
    console.log(`🔔 Notificação simulada: Cliente confirmou a reunião ${reuniaoId}`);
}

function simularNotificacaoProposta(reuniaoId, novaData, novaHora) {
    console.log(`🔔 Notificação simulada: Cliente propôs novo horário - ${novaData} às ${novaHora}`);
}

// Funções dos Modais
function fecharModalConfirmacao() {
    document.getElementById('modal-confirmacao').style.display = 'none';
    reuniaoSelecionada = null;
}

function fecharModalHorario() {
    document.getElementById('modal-novo-horario').style.display = 'none';
    document.getElementById('nova-data').value = '';
    document.getElementById('nova-hora').value = '';
    reuniaoSelecionada = null;
}

// Fechar modais clicando fora
window.onclick = function(event) {
    const modals = ['modal-confirmacao', 'modal-novo-horario'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
            if (modalId === 'modal-confirmacao') fecharModalConfirmacao();
            if (modalId === 'modal-novo-horario') fecharModalHorario();
        }
    });
};

console.log("🎯 Sistema corporativo carregado e pronto!");
