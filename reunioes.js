/**
 * GERENCIADOR DE REUNIÕES - JAVASCRIPT
 * 
 * Funcionalidades:
 * - Agendamento de reuniões com horário de início e fim
 * - Validação de conflitos de horário
 * - Indicador em tempo real de reunião em andamento
 * - Filtro por data
 * - Exclusão de reuniões
 * - Notificações toast
 */

// ============================================
// 1. CONFIGURAÇÃO FIREBASE
// ============================================

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

let reuniaoParaExcluir = null;
let unsubscribeReunioes = null;
let filtroDataAtual = "";
let reuniaoEmAndamento = null;
let intervalAtualizacao = null;

// Elementos do DOM
const form = document.getElementById("form-reuniao");
const listaReunioes = document.getElementById("lista-reunioes");
const filtroData = document.getElementById("filtro-data");
const modalExcluir = document.getElementById("modal-excluir");
const btnSubmit = document.getElementById("btn-submit");
const toastContainer = document.getElementById("toast-container");
const horaAtual = document.getElementById("hora-atual");
const reuniaoAoVivo = document.getElementById("reuniao-ao-vivo");

// ============================================
// 3. VALIDAÇÃO DE DADOS
// ============================================

const validacaoSchema = {
  titulo: {
    minLength: 3,
    maxLength: 100,
    mensagem: "Título deve ter 3-100 caracteres"
  },
  participantes: {
    minLength: 3,
    maxLength: 200,
    mensagem: "Participantes deve ter 3-200 caracteres"
  },
  data: {
    required: true,
    mensagem: "Data é obrigatória"
  },
  "hora-inicio": {
    required: true,
    mensagem: "Hora de início é obrigatória"
  },
  "hora-fim": {
    required: true,
    mensagem: "Hora de fim é obrigatória"
  },
  descricao: {
    maxLength: 500,
    mensagem: "Descrição não pode exceder 500 caracteres"
  }
};

function validarCampo(nome, valor) {
  const schema = validacaoSchema[nome];
  if (!schema) return { valido: true };

  if (schema.required && !valor) {
    return { valido: false, mensagem: schema.mensagem };
  }

  if (schema.minLength && valor.length < schema.minLength) {
    return { valido: false, mensagem: schema.mensagem };
  }

  if (schema.maxLength && valor.length > schema.maxLength) {
    return { valido: false, mensagem: schema.mensagem };
  }

  return { valido: true };
}

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

function mostrarNotificacao(mensagem, tipo = "info", duracao = 4000) {
  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.textContent = mensagem;

  toastContainer.appendChild(toast);

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

function formatarData(data) {
  try {
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  } catch (error) {
    return data;
  }
}

function formatarHora(hora) {
  return hora;
}

function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

// ============================================
// 6. HORA ATUAL
// ============================================

function atualizarHoraAtual() {
  const agora = new Date();
  const horas = String(agora.getHours()).padStart(2, '0');
  const minutos = String(agora.getMinutes()).padStart(2, '0');
  const segundos = String(agora.getSeconds()).padStart(2, '0');
  
  horaAtual.textContent = `${horas}:${minutos}:${segundos}`;
}

// Atualizar hora a cada segundo
setInterval(atualizarHoraAtual, 1000);
atualizarHoraAtual();

// ============================================
// 7. VALIDAÇÃO DE CONFLITOS
// ============================================

/**
 * Verifica se existe conflito de horário com outra reunião
 */
function verificarConflito(data, horaInicio, horaFim, reuniaoIdExcluir = null) {
  if (!database) return false;

  let temConflito = false;

  // Buscar todas as reuniões da data
  const reunioesRef = database.ref("reunioes");
  
  reunioesRef.orderByChild("data").equalTo(data).once("value", (snapshot) => {
    if (snapshot.exists()) {
      const dados = snapshot.val();
      
      Object.entries(dados).forEach(([id, reuniao]) => {
        // Ignorar a reunião que está sendo editada
        if (reuniaoIdExcluir && id === reuniaoIdExcluir) return;

        const inicioExistente = reuniao["hora-inicio"];
        const fimExistente = reuniao["hora-fim"];

        // Verificar sobreposição de horários
        if (horaInicio < fimExistente && horaFim > inicioExistente) {
          temConflito = true;
        }
      });
    }
  });

  return temConflito;
}

// ============================================
// 8. VALIDAÇÃO DE HORA
// ============================================

function validarHoras(horaInicio, horaFim) {
  if (horaInicio >= horaFim) {
    return {
      valido: false,
      mensagem: "Hora de fim deve ser posterior à hora de início"
    };
  }
  return { valido: true };
}

function validarDataFutura(data, horaInicio) {
  const agora = new Date();
  const reuniaoDateTime = new Date(data + "T" + horaInicio);
  return reuniaoDateTime > agora;
}

// ============================================
// 9. CONFIGURAÇÃO DO FORMULÁRIO
// ============================================

function configurarDataMinima() {
  const inputData = document.getElementById("data");
  const hoje = new Date().toISOString().split("T")[0];
  inputData.min = hoje;
}

// Atualizar contador de caracteres
document.getElementById("descricao")?.addEventListener("input", (e) => {
  const contador = document.getElementById("char-count");
  if (contador) {
    contador.textContent = e.target.value.length;
  }
});

// Validação em tempo real
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

// ============================================
// 10. ENVIO DO FORMULÁRIO
// ============================================

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!database) {
    mostrarNotificacao("Firebase não está configurado", "error");
    return;
  }

  // Coletar dados
  const titulo = document.getElementById("titulo").value.trim();
  const participantes = document.getElementById("participantes").value.trim();
  const data = document.getElementById("data").value;
  const horaInicio = document.getElementById("hora-inicio").value;
  const horaFim = document.getElementById("hora-fim").value;
  const descricao = document.getElementById("descricao").value.trim();

  // Validar todos os campos
  limparErros();
  let temErro = false;

  const validacoes = {
    titulo: validarCampo("titulo", titulo),
    participantes: validarCampo("participantes", participantes),
    data: validarCampo("data", data),
    "hora-inicio": validarCampo("hora-inicio", horaInicio),
    "hora-fim": validarCampo("hora-fim", horaFim),
    descricao: validarCampo("descricao", descricao)
  };

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

  // Validar horas
  const validacaoHoras = validarHoras(horaInicio, horaFim);
  if (!validacaoHoras.valido) {
    exibirErro("hora-fim", validacaoHoras.mensagem);
    mostrarNotificacao(validacaoHoras.mensagem, "error");
    return;
  }

  // Validar se a data é futura
  if (!validarDataFutura(data, horaInicio)) {
    exibirErro("data", "Não é possível agendar para datas/horários passados");
    mostrarNotificacao("Não é possível agendar para datas/horários passados", "error");
    return;
  }

  // Verificar conflito de horário
  if (verificarConflito(data, horaInicio, horaFim)) {
    mostrarNotificacao("Já existe uma reunião agendada para este horário", "error");
    return;
  }

  // Desabilitar botão
  btnSubmit.disabled = true;
  btnSubmit.textContent = "Agendando...";

  try {
    const reunioesRef = database.ref("reunioes");
    const novaReuniaoRef = reunioesRef.push();

    await novaReuniaoRef.set({
      titulo: titulo,
      participantes: participantes,
      data: data,
      "hora-inicio": horaInicio,
      "hora-fim": horaFim,
      descricao: descricao || "Sem descrição",
      timestamp: new Date().toISOString()
    });

    console.log("✅ Reunião agendada com sucesso!");
    mostrarNotificacao("Reunião agendada com sucesso!", "success");
    form.reset();
    limparErros();
    configurarDataMinima();
  } catch (error) {
    console.error("❌ Erro ao agendar:", error);
    mostrarNotificacao(`Erro ao agendar: ${error.message}`, "error");
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Agendar Reunião";
  }
});

// ============================================
// 11. CARREGAMENTO E LISTAGEM
// ============================================

function carregarReunioes() {
  if (!database) {
    listaReunioes.innerHTML = '<p class="vazio">Firebase não está configurado</p>';
    return;
  }

  const reunioesRef = database.ref("reunioes");

  if (unsubscribeReunioes) {
    unsubscribeReunioes();
  }

  unsubscribeReunioes = reunioesRef.on("value", (snapshot) => {
    console.log("📊 Carregando reuniões...");

    if (snapshot.exists()) {
      const dados = snapshot.val();
      let reunioesArray = Object.entries(dados).map(([id, reuniao]) => ({
        id,
        ...reuniao
      }));

      // Aplicar filtro se existir
      if (filtroDataAtual) {
        reunioesArray = reunioesArray.filter(r => r.data === filtroDataAtual);
      }

      // Ordenar por data e hora
      reunioesArray.sort((a, b) => {
        const dataA = new Date(a.data + "T" + a["hora-inicio"]);
        const dataB = new Date(b.data + "T" + b["hora-inicio"]);
        return dataA - dataB;
      });

      if (reunioesArray.length > 0) {
        renderizarReunioes(reunioesArray);
        console.log(`✅ ${reunioesArray.length} reuniões carregadas`);
      } else {
        listaReunioes.innerHTML = '<p class="vazio">Nenhuma reunião agendada</p>';
      }
    } else {
      listaReunioes.innerHTML = '<p class="vazio">Nenhuma reunião agendada</p>';
    }
  }, (error) => {
    console.error("❌ Erro ao carregar:", error);
    mostrarNotificacao("Erro ao carregar reuniões", "error");
  });
}

function renderizarReunioes(reunioes) {
  const agora = new Date();
  
  listaReunioes.innerHTML = reunioes.map(reuniao => {
    const dataReuniaoStr = reuniao.data + "T" + reuniao["hora-inicio"];
    const fimReuniaoStr = reuniao.data + "T" + reuniao["hora-fim"];
    const dataReuniaoInicio = new Date(dataReuniaoStr);
    const dataReuniaoFim = new Date(fimReuniaoStr);
    
    const estaAoVivo = agora >= dataReuniaoInicio && agora < dataReuniaoFim;
    
    return `
      <div class="reuniao-item ${estaAoVivo ? 'ao-vivo' : ''}">
        <div class="reuniao-header">
          <h3 class="reuniao-titulo">${escapeHtml(reuniao.titulo)}</h3>
          ${estaAoVivo ? '<span class="reuniao-badge"><span class="pulse"></span>AO VIVO</span>' : ''}
        </div>
        
        <div class="reuniao-info">
          <div class="reuniao-info-item">
            <span class="reuniao-info-label">Data:</span>
            <span class="reuniao-info-value">${formatarData(reuniao.data)}</span>
          </div>
          <div class="reuniao-info-item">
            <span class="reuniao-info-label">Horário:</span>
            <span class="reuniao-info-value">${formatarHora(reuniao["hora-inicio"])} - ${formatarHora(reuniao["hora-fim"])}</span>
          </div>
          <div class="reuniao-info-item">
            <span class="reuniao-info-label">Participantes:</span>
            <span class="reuniao-info-value">${escapeHtml(reuniao.participantes)}</span>
          </div>
          <div class="reuniao-info-item">
            <span class="reuniao-info-label">Duração:</span>
            <span class="reuniao-info-value">${calcularDuracao(reuniao["hora-inicio"], reuniao["hora-fim"])}</span>
          </div>
        </div>
        
        ${reuniao.descricao && reuniao.descricao !== "Sem descrição" ? `
          <div class="reuniao-descricao">
            <strong>Pauta:</strong> ${escapeHtml(reuniao.descricao)}
          </div>
        ` : ''}
        
        <div class="reuniao-acoes">
          <button 
            class="btn btn-danger btn-small" 
            onclick="abrirModalExclusao('${reuniao.id}')"
            aria-label="Excluir reunião de ${reuniao.titulo}"
          >
            Excluir
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function calcularDuracao(horaInicio, horaFim) {
  const [hInicio, mInicio] = horaInicio.split(':').map(Number);
  const [hFim, mFim] = horaFim.split(':').map(Number);
  
  let minutos = (hFim * 60 + mFim) - (hInicio * 60 + mInicio);
  
  if (minutos < 60) {
    return `${minutos}min`;
  }
  
  const horas = Math.floor(minutos / 60);
  minutos = minutos % 60;
  
  if (minutos === 0) {
    return `${horas}h`;
  }
  
  return `${horas}h ${minutos}min`;
}

// ============================================
// 12. REUNIÃO AO VIVO
// ============================================

function atualizarReuniaoAoVivo() {
  if (!database) return;

  const agora = new Date();
  const reunioesRef = database.ref("reunioes");

  reunioesRef.once("value", (snapshot) => {
    if (!snapshot.exists()) {
      ocultarReuniaoAoVivo();
      return;
    }

    const dados = snapshot.val();
    let reuniaoAtual = null;

    Object.entries(dados).forEach(([id, reuniao]) => {
      const dataReuniaoStr = reuniao.data + "T" + reuniao["hora-inicio"];
      const fimReuniaoStr = reuniao.data + "T" + reuniao["hora-fim"];
      const dataReuniaoInicio = new Date(dataReuniaoStr);
      const dataReuniaoFim = new Date(fimReuniaoStr);

      if (agora >= dataReuniaoInicio && agora < dataReuniaoFim) {
        reuniaoAtual = {
          id,
          ...reuniao,
          dataFim: dataReuniaoFim
        };
      }
    });

    if (reuniaoAtual) {
      exibirReuniaoAoVivo(reuniaoAtual);
    } else {
      ocultarReuniaoAoVivo();
    }
  });
}

function exibirReuniaoAoVivo(reuniao) {
  reuniaoEmAndamento = reuniao;
  
  document.getElementById("reuniao-titulo").textContent = escapeHtml(reuniao.titulo);
  
  const tempoRestante = calcularTempoRestante(reuniao.dataFim);
  document.getElementById("reuniao-tempo").textContent = `Tempo restante: ${tempoRestante}`;
  
  reuniaoAoVivo.classList.remove("hidden");
}

function ocultarReuniaoAoVivo() {
  reuniaoEmAndamento = null;
  reuniaoAoVivo.classList.add("hidden");
}

function calcularTempoRestante(dataFim) {
  const agora = new Date();
  const diferenca = dataFim - agora;

  if (diferenca <= 0) {
    return "Finalizando...";
  }

  const minutos = Math.floor(diferenca / 60000);
  const segundos = Math.floor((diferenca % 60000) / 1000);

  if (minutos === 0) {
    return `${segundos}s`;
  }

  return `${minutos}min ${segundos}s`;
}

// Atualizar reunião ao vivo a cada segundo
setInterval(atualizarReuniaoAoVivo, 1000);
atualizarReuniaoAoVivo();

// ============================================
// 13. FILTROS
// ============================================

function filtrarPorData() {
  const data = filtroData.value;

  if (!data) {
    mostrarNotificacao("Selecione uma data para filtrar", "warning");
    return;
  }

  filtroDataAtual = data;
  console.log("🔍 Filtrando por data:", data);
  carregarReunioes();
}

function limparFiltro() {
  filtroData.value = "";
  filtroDataAtual = "";
  console.log("🧹 Filtro limpo");
  carregarReunioes();
}

// ============================================
// 14. MODAL DE EXCLUSÃO
// ============================================

function abrirModalExclusao(id) {
  reuniaoParaExcluir = id;
  modalExcluir.classList.add("show");
  modalExcluir.setAttribute("aria-hidden", "false");
}

function fecharModal() {
  reuniaoParaExcluir = null;
  modalExcluir.classList.remove("show");
  modalExcluir.setAttribute("aria-hidden", "true");
}

async function confirmarExclusao() {
  if (!reuniaoParaExcluir) return;

  try {
    console.log("🗑️ Excluindo reunião:", reuniaoParaExcluir);

    await database.ref("reunioes/" + reuniaoParaExcluir).remove();

    console.log("✅ Reunião excluída com sucesso");
    mostrarNotificacao("Reunião excluída com sucesso!", "success");
    fecharModal();
  } catch (error) {
    console.error("❌ Erro ao excluir:", error);
    mostrarNotificacao(`Erro ao excluir: ${error.message}`, "error");
  }
}

modalExcluir.addEventListener("click", (e) => {
  if (e.target === modalExcluir) {
    fecharModal();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalExcluir.classList.contains("show")) {
    fecharModal();
  }
});

// ============================================
// 15. INICIALIZAÇÃO
// ============================================

function inicializar() {
  console.log("🚀 Inicializando Gerenciador de Reuniões...");

  configurarDataMinima();
  carregarReunioes();

  console.log("✅ Sistema pronto!");
  mostrarNotificacao("Sistema carregado com sucesso!", "success", 3000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializar);
} else {
  inicializar();
}

// ============================================
// 16. CLEANUP
// ============================================

window.addEventListener("beforeunload", () => {
  if (unsubscribeReunioes) {
    unsubscribeReunioes();
  }
  if (intervalAtualizacao) {
    clearInterval(intervalAtualizacao);
  }
});

console.log("🎯 Script carregado com sucesso!");
