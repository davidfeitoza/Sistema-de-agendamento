// ============================================
// 1. CONFIGURAÇÃO INICIAL
// ============================================

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
let app = null;
let database = null;

try {
  app = firebase.initializeApp(firebaseConfig);
  database = firebase.database();
  console.log("✅ Firebase inicializado com sucesso");
} catch (error) {
  console.error("❌ Erro ao inicializar Firebase:", error);
  mostrarNotificacao("Erro ao conectar ao banco de dados", "error");
}

// ============================================
// 2. VARIÁVEIS GLOBAIS
// ============================================

let agendamentoParaExcluir = null;
let unsubscribeAgendamentos = null;
let filtroDataAtual = "";

// Elementos do DOM
const form = document.getElementById("form-agendamento");
const listaAgendamentos = document.getElementById("lista-agendamentos");
const filtroData = document.getElementById("filtro-data");
const modalExcluir = document.getElementById("modal-excluir");
const btnSubmit = document.getElementById("btn-submit");
const toastContainer = document.getElementById("toast-container");

// ============================================
// 3. VALIDAÇÃO DE DADOS
// ============================================

/**
 * Schema de validação para agendamentos
 */
const validacaoSchema = {
  cliente: {
    minLength: 3,
    maxLength: 100,
    pattern: /^[a-zA-Z\s\u00C0-\u00FF]+$/,
    mensagem: "Nome deve ter 3-100 caracteres e conter apenas letras"
  },
  servico: {
    required: true,
    mensagem: "Selecione um serviço"
  },
  data: {
    required: true,
    mensagem: "Data é obrigatória"
  },
  hora: {
    required: true,
    pattern: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/,
    mensagem: "Hora inválida"
  },
  observacoes: {
    maxLength: 500,
    mensagem: "Observações não podem exceder 500 caracteres"
  }
};

/**
 * Valida um campo individual
 */
function validarCampo(nome, valor) {
  const schema = validacaoSchema[nome];
  if (!schema) return { valido: true };

  // Validação obrigatória
  if (schema.required && !valor) {
    return { valido: false, mensagem: schema.mensagem };
  }

  // Validação de comprimento mínimo
  if (schema.minLength && valor.length < schema.minLength) {
    return { valido: false, mensagem: schema.mensagem };
  }

  // Validação de comprimento máximo
  if (schema.maxLength && valor.length > schema.maxLength) {
    return { valido: false, mensagem: schema.mensagem };
  }

  // Validação de padrão
  if (schema.pattern && valor && !schema.pattern.test(valor)) {
    return { valido: false, mensagem: schema.mensagem };
  }

  return { valido: true };
}

/**
 * Exibe mensagem de erro em um campo
 */
function exibirErro(nomeInput, mensagem) {
  const input = document.getElementById(nomeInput);
  const errorSpan = document.getElementById(`${nomeInput}-error`);

  if (errorSpan) {
    if (mensagem) {
      errorSpan.textContent = mensagem;
      errorSpan.classList.add("show");
      input.setAttribute("aria-invalid", "true");
    } else {
      errorSpan.textContent = "";
      errorSpan.classList.remove("show");
      input.setAttribute("aria-invalid", "false");
    }
  }
}

/**
 * Limpa todos os erros do formulário
 */
function limparErros() {
  document.querySelectorAll(".error-message").forEach(el => {
    el.textContent = "";
    el.classList.remove("show");
  });
  document.querySelectorAll("[aria-invalid]").forEach(el => {
    el.setAttribute("aria-invalid", "false");
  });
}

// ============================================
// 4. NOTIFICAÇÕES TOAST
// ============================================

/**
 * Mostra uma notificação toast
 */
function mostrarNotificacao(mensagem, tipo = "info", duracao = 4000) {
  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  // Ícone baseado no tipo
  const icones = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️"
  };

  toast.innerHTML = `
    <span>${icones[tipo]} ${mensagem}</span>
    <button class="toast-close" aria-label="Fechar notificação">×</button>
  `;

  toastContainer.appendChild(toast);

  // Evento para fechar manualmente
  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.remove();
  });

  // Auto-remover após duração
  if (duracao > 0) {
    setTimeout(() => {
      toast.style.animation = "slideInRight 0.3s ease-in-out reverse";
      setTimeout(() => toast.remove(), 300);
    }, duracao);
  }
}

// ============================================
// 5. FORMATAÇÃO DE DADOS
// ============================================

/**
 * Formata data de YYYY-MM-DD para DD/MM/YYYY
 */
function formatarData(data) {
  try {
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  } catch (error) {
    console.error("Erro ao formatar data:", error);
    return data;
  }
}

/**
 * Valida se a data/hora é futura
 */
function validarDataFutura(data, hora) {
  try {
    const agendamentoDateTime = new Date(data + "T" + hora);
    const agora = new Date();
    return agendamentoDateTime > agora;
  } catch (error) {
    console.error("Erro ao validar data:", error);
    return false;
  }
}

// ============================================
// 6. FORMULÁRIO
// ============================================

/**
 * Configura data mínima como hoje
 */
function configurarDataMinima() {
  const inputData = document.getElementById("data");
  const hoje = new Date().toISOString().split("T")[0];
  inputData.min = hoje;
}

/**
 * Atualiza contador de caracteres das observações
 */
document.getElementById("observacoes")?.addEventListener("input", (e) => {
  const contador = document.getElementById("char-count");
  if (contador) {
    contador.textContent = e.target.value.length;
  }
});

/**
 * Valida campos em tempo real
 */
document.querySelectorAll("input, select, textarea").forEach(input => {
  input.addEventListener("blur", () => {
    if (input.name) {
      const validacao = validarCampo(input.name, input.value.trim());
      if (!validacao.valido) {
        exibirErro(input.id, validacao.mensagem);
      } else {
        exibirErro(input.id, "");
      }
    }
  });
});

/**
 * Manipula o envio do formulário
 */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!database) {
    mostrarNotificacao("Firebase não está configurado", "error");
    return;
  }

  // Coletar dados
  const cliente = document.getElementById("cliente").value.trim();
  const servico = document.getElementById("servico").value;
  const data = document.getElementById("data").value;
  const hora = document.getElementById("hora").value;
  const observacoes = document.getElementById("observacoes").value.trim();

  // Validar todos os campos
  limparErros();
  let temErro = false;

  const validacoes = {
    cliente: validarCampo("cliente", cliente),
    servico: validarCampo("servico", servico),
    data: validarCampo("data", data),
    hora: validarCampo("hora", hora),
    observacoes: validarCampo("observacoes", observacoes)
  };

  // Exibir erros
  Object.entries(validacoes).forEach(([campo, resultado]) => {
    if (!resultado.valido) {
      exibirErro(campo, resultado.mensagem);
      temErro = true;
    }
  });

  if (temErro) {
    mostrarNotificacao("Por favor, corrija os erros no formulário", "warning");
    return;
  }

  // Validar se a data é futura
  if (!validarDataFutura(data, hora)) {
    exibirErro("data", "Não é possível agendar para datas/horários passados");
    mostrarNotificacao("Não é possível agendar para datas/horários passados", "error");
    return;
  }

  // Desabilitar botão durante envio
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<span class="loading"></span> Salvando...';

  try {
    // Salvar no Firebase
    const agendamentosRef = database.ref("agendamentos");
    const novoAgendamento = agendamentosRef.push();

    await novoAgendamento.set({
      cliente: cliente,
      servico: servico,
      data: data,
      hora: hora,
      observacoes: observacoes || "Nenhuma observação",
      timestamp: new Date().toISOString()
    });

    console.log("✅ Agendamento salvo com sucesso!");
    mostrarNotificacao("Agendamento salvo com sucesso!", "success");
    form.reset();
    limparErros();
    configurarDataMinima();
  } catch (error) {
    console.error("❌ Erro ao salvar agendamento:", error);
    mostrarNotificacao(`Erro ao salvar: ${error.message}`, "error");
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = "💾 Salvar Agendamento";
  }
});

// ============================================
// 7. CARREGAMENTO E LISTAGEM
// ============================================

/**
 * Carrega e exibe agendamentos em tempo real
 */
function carregarAgendamentos() {
  if (!database) {
    listaAgendamentos.innerHTML = '<p class="vazio">Firebase não está configurado</p>';
    return;
  }

  const agendamentosRef = database.ref("agendamentos");

  // Remover listener anterior se existir
  if (unsubscribeAgendamentos) {
    unsubscribeAgendamentos();
  }

  // Novo listener
  unsubscribeAgendamentos = agendamentosRef.on("value", (snapshot) => {
    console.log("📊 Carregando agendamentos...");

    if (snapshot.exists()) {
      const dados = snapshot.val();
      let agendamentosArray = Object.entries(dados).map(([id, ag]) => ({
        id,
        ...ag
      }));

      // Aplicar filtro se existir
      if (filtroDataAtual) {
        agendamentosArray = agendamentosArray.filter(ag => ag.data === filtroDataAtual);
      }

      // Ordenar por data e hora
      agendamentosArray.sort((a, b) => {
        const dataA = new Date(a.data + "T" + a.hora);
        const dataB = new Date(b.data + "T" + b.hora);
        return dataA - dataB;
      });

      if (agendamentosArray.length > 0) {
        renderizarAgendamentos(agendamentosArray);
        console.log(`✅ ${agendamentosArray.length} agendamentos carregados`);
      } else {
        listaAgendamentos.innerHTML = '<p class="vazio">Nenhum agendamento encontrado</p>';
      }
    } else {
      listaAgendamentos.innerHTML = '<p class="vazio">Nenhum agendamento cadastrado ainda</p>';
      console.log("📭 Nenhum agendamento no banco de dados");
    }
  }, (error) => {
    console.error("❌ Erro ao carregar agendamentos:", error);
    mostrarNotificacao("Erro ao carregar agendamentos", "error");
    listaAgendamentos.innerHTML = '<p class="vazio">Erro ao carregar agendamentos</p>';
  });
}

/**
 * Renderiza a lista de agendamentos no DOM
 */
function renderizarAgendamentos(agendamentos) {
  listaAgendamentos.innerHTML = agendamentos.map(ag => `
    <div class="agendamento-item">
      <div class="agendamento-info">
        <h3>👤 ${escapeHtml(ag.cliente)}</h3>
        <p>📋 Serviço: ${escapeHtml(ag.servico)}</p>
        <p>📅 Data: ${formatarData(ag.data)}</p>
        <p>⏰ Hora: ${ag.hora}</p>
        <p>📝 Observações: ${escapeHtml(ag.observacoes)}</p>
      </div>
      <div class="agendamento-acoes">
        <button 
          class="btn btn-excluir" 
          onclick="abrirModalExclusao('${ag.id}')"
          aria-label="Excluir agendamento de ${ag.cliente}"
        >
          🗑️ Excluir
        </button>
      </div>
    </div>
  `).join("");
}

/**
 * Escapa caracteres HTML para prevenir XSS
 */
function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

// ============================================
// 8. FILTROS
// ============================================

/**
 * Filtra agendamentos por data
 */
function filtrarPorData() {
  const data = filtroData.value;

  if (!data) {
    mostrarNotificacao("Selecione uma data para filtrar", "warning");
    return;
  }

  filtroDataAtual = data;
  console.log("🔍 Filtrando por data:", data);
  carregarAgendamentos();
}

/**
 * Limpa o filtro de data
 */
function limparFiltro() {
  filtroData.value = "";
  filtroDataAtual = "";
  console.log("🧹 Filtro limpo");
  carregarAgendamentos();
}

// ============================================
// 9. MODAL DE EXCLUSÃO
// ============================================

/**
 * Abre o modal de confirmação de exclusão
 */
function abrirModalExclusao(id) {
  agendamentoParaExcluir = id;
  modalExcluir.classList.add("show");
  modalExcluir.setAttribute("aria-hidden", "false");
}

/**
 * Fecha o modal
 */
function fecharModal() {
  agendamentoParaExcluir = null;
  modalExcluir.classList.remove("show");
  modalExcluir.setAttribute("aria-hidden", "true");
}

/**
 * Confirma e executa a exclusão
 */
async function confirmarExclusao() {
  if (!agendamentoParaExcluir) return;

  try {
    console.log("🗑️ Excluindo agendamento:", agendamentoParaExcluir);

    await database.ref("agendamentos/" + agendamentoParaExcluir).remove();

    console.log("✅ Agendamento excluído com sucesso");
    mostrarNotificacao("Agendamento excluído com sucesso!", "success");
    fecharModal();
  } catch (error) {
    console.error("❌ Erro ao excluir:", error);
    mostrarNotificacao(`Erro ao excluir: ${error.message}`, "error");
  }
}

/**
 * Fecha modal ao clicar fora
 */
modalExcluir.addEventListener("click", (e) => {
  if (e.target === modalExcluir) {
    fecharModal();
  }
});

/**
 * Suporte a tecla ESC para fechar modal
 */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalExcluir.classList.contains("show")) {
    fecharModal();
  }
});

// ============================================
// 10. INICIALIZAÇÃO
// ============================================

/**
 * Inicializa a aplicação
 */
function inicializar() {
  console.log("🚀 Inicializando Sistema de Agendamentos...");

  configurarDataMinima();
  carregarAgendamentos();

  console.log("✅ Sistema pronto!");
  mostrarNotificacao("Sistema carregado com sucesso!", "success", 3000);
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializar);
} else {
  inicializar();
}

// ============================================
// 11. CLEANUP
// ============================================

/**
 * Limpa recursos quando a página é descarregada
 */
window.addEventListener("beforeunload", () => {
  if (unsubscribeAgendamentos) {
    unsubscribeAgendamentos();
  }
});

console.log("🎯 Script carregado com sucesso!");
