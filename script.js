const tarefaInput = document.getElementById("tarefaInput");
const adicionarBtn = document.getElementById("adicionarBtn");
const listaTarefas = document.getElementById("listaTarefas");

function adicionarTarefa() {
  const textoTarefa = tarefaInput.value.trim();

  if (textoTarefa === "") {
    alert("Digite uma tarefa antes de adicionar.");
    return;
  }

  const li = document.createElement("li");
  const span = document.createElement("span");
  const botaoRemover = document.createElement("button");

  span.textContent = textoTarefa;
  botaoRemover.textContent = "Excluir";
  botaoRemover.classList.add("remover-btn");

  span.addEventListener("click", function () {
    span.classList.toggle("tarefa-concluida");
  });

  botaoRemover.addEventListener("click", function () {
    li.remove();
  });

  li.appendChild(span);
  li.appendChild(botaoRemover);
  listaTarefas.appendChild(li);

  tarefaInput.value = "";
  tarefaInput.focus();
}

adicionarBtn.addEventListener("click", adicionarTarefa);

tarefaInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    adicionarTarefa();
  }
});
