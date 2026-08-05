fetch("http://localhost:3000/clientes")
.then(res => res.json())
.then(clientes => {

    const tabla = document.getElementById("tablaClientes");

    clientes.forEach(cliente => {

        tabla.innerHTML += `
        <tr>

            <td>${cliente.id_cliente}</td>
            <td>${cliente.documento}</td>
            <td>${cliente.nombres}</td>
            <td>${cliente.apellidos}</td>
            <td>${cliente.email}</td>
            <td>${cliente.telefono}</td>
            <td>${cliente.ciudad}</td>
            <td>${cliente.estado}</td>

        </tr>
        `;

    });

});