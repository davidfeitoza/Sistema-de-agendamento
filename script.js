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

console.log("🔥 Sistema de Agendamentos Iniciado!");

// Variáveis globais
let agendamentoParaExcluir = null;
const agendamentosRef = database.ref('agendamentos');
const form = document.getElementById('form-agendamento');
const listaAgendamentos = document.getElementById('lista-agendamentos');

// Configurar data mínima para hoje
document.getElementById('data').min = new Date().toISOString().split('T')[0];

// Salvar agendamento
form.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const cliente = document.getElementById('cliente').value.trim();
  const servico = document.getElementById('servico').value;
  const data = document.getElementById('data').value;
  const hora = document.getElementById('hora').value;
  const observacoes = document.getElementById('observacoes').value.trim();

  // Validações
  if (!cliente || !servico || !data || !hora) {
    alert("Por favor, preencha todos os campos obrigatórios!");
    return;
  }

  // Verificar se a data é futura
  const dataAgendamento = new Date(data + 'T' + hora);
  if (dataAgendamento < new Date()) {
    alert("Não é possível agendar para datas/horários passados!");
    return;
  }

  console.log("💾 Salvando agendamento...", { cliente, servico, data, hora, observacoes });

  // Salvar no Firebase
  const novoAgendamento = agendamentosRef.push();
  novoAgendamento.set({
    cliente: cliente,
    servico: servico,
    data: data,
    hora: hora,
    observacoes: observacoes || 'Nenhuma observação',
    timestamp: new Date().toISOString()
  })
  .then(() => {
    console.log("✅ Agendamento salvo com sucesso!");
    alert("Agendamento salvo com sucesso! ✅");
    form.reset();
    // Resetar data mínima
    document.getElementById('data').min = new Date().toISOString().split('T')[0];
  })
  .catch((error) => {
    console.error("❌ Erro ao salvar:", error);
    alert("Erro ao salvar agendamento: " + error.message);
  });
});

// Carregar agendamentos em tempo real
agendamentosRef.on('value', (snapshot) => {
  console.log("📊 Carregando agendamentos...");
  
  const agendamentos = snapshot.val();
  const filtroData = document.getElementById('filtro-data').value;

  if (agendamentos) {
    let agendamentosArray = Object.entries(agendamentos);
    
    // Aplicar filtro se existir
    if (filtroData) {
      agendamentosArray = agendamentosArray.filter(([id, ag]) => ag.data === filtroData);
    }
    
    // Ordenar por data e hora
    agendamentosArray.sort((a, b) => {
      const dataA = new Date(a[1].data + 'T' + a[1].hora);
      const dataB = new Date(b[1].data + 'T' + b[1].hora);
      return dataA - dataB;
    });

    if (agendamentosArray.length > 0) {
      let html = '';
      agendamentosArray.forEach(([id, ag]) => {
        const dataFormatada = formatarData(ag.data);
        html += `
          <div class="agendamento-item">
            <div class="agendamento-info">
              <h3>👤 ${ag.cliente}</h3>
              <p>📋 Serviço: ${ag.servico}</p>
              <p>📅 Data: ${dataFormatada}</p>
              <p>⏰ Hora: ${ag.hora}</p>
              <p>📝 Observações: ${ag.observacoes}</p>
            </div>
            <div class="agendamento-acoes">
              <button class="btn-excluir" onclick="abrirModalExclusao('${id}')">
                🗑️ Excluir
              </button>
            </div>
          </div>
        `;
      });
      listaAgendamentos.innerHTML = html;
      console.log(`✅ ${agendamentosArray.length} agendamentos carregados`);
    } else {
      listaAgendamentos.innerHTML = '<p class="vazio">Nenhum agendamento encontrado</p>';
    }
  } else {
    listaAgendamentos.innerHTML = '<p class="vazio">Nenhum agendamento cadastrado ainda</p>';
    console.log("📭 Nenhum agendamento no banco de dados");
  }
});

// Função para formatar data (DD/MM/AAAA)
function formatarData(data) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Funções do Modal de Exclusão
function abrirModalExclusao(id) {
  agendamentoParaExcluir = id;
  document.getElementById('modal-excluir').style.display = 'flex';
}

function fecharModal() {
  agendamentoParaExcluir = null;
  document.getElementById('modal-excluir').style.display = 'none';
}

function confirmarExclusao() {
  if (agendamentoParaExcluir) {
    console.log("🗑️ Excluindo agendamento:", agendamentoParaExcluir);
    
    database.ref('agendamentos/' + agendamentoParaExcluir).remove()
      .then(() => {
        console.log("✅ Agendamento excluído com sucesso");
        alert("Agendamento excluído! ✅");
        fecharModal();
      })
      .catch((error) => {
        console.error("❌ Erro ao excluir:", error);
        alert("Erro ao excluir agendamento: " + error.message);
        fecharModal();
      });
  }
}

// Funções de Filtro
function filtrarPorData() {
  const filtroData = document.getElementById('filtro-data').value;
  if (filtroData) {
    console.log("🔍 Filtrando por data:", filtroData);
    // A recarregagem automática é feita pelo listener do Firebase
  } else {
    alert("Selecione uma data para filtrar!");
  }
}

function limparFiltro() {
  document.getElementById('filtro-data').value = '';
  console.log("🧹 Filtro limpo");
  // A recarregagem automática é feita pelo listener do Firebase
}

// Fechar modal clicando fora
window.onclick = function(event) {
  const modal = document.getElementById('modal-excluir');
  if (event.target === modal) {
    fecharModal();
  }
};

console.log("🎯 Sistema de agendamentos carregado e pronto!");
