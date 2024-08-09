const htmlMenu = `
<ul class="menu">
  <li class="menu-item" id="addComand" onclick="addCommandHandler()">
    <a href="#" class="menu-btn">
      <i class="fa fa-folder-open"></i>
      <span class="menu-text">Add to curent editor pane</span>
        </a>
    </li>
  <li class="menu-item menu-item-disabled" id="addCommandNewPane">
    <button type="button" class="menu-btn">
      <span class="menu-text">Add to new editor pane</span>
        </button>
    </li>
  <li class="menu-separator"></li>
  
</ul>`

var menu;
var currentCommand;

function createCM() {
  const newElement = document.createElement('div');
  newElement.innerHTML = htmlMenu;

  document.body.appendChild(newElement);
  menu = document.querySelector('.menu');
}


 // createCM()



function showMenu(x, y){
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.classList.add('menu-show');
}

function hideMenu(){
  menu.classList.remove('menu-show');
}

function onContextMenu(e){
  e.preventDefault();
  currentCommand = e.currentTarget.textContent;
  console.log('onContextMenu', e.pageX, e.pageY, currentCommand);

  showMenu(e.pageX, e.pageY);
  document.addEventListener('mousedown', onMouseDown, false);
}

function onMouseDown(e){
  e.preventDefault();
  alert(e.target.id+' | '+e.target.id+'!'+currentCommand );
  window.parent.postMessage({command:currentCommand,oper:e.target.id}, '*'); // Send the message to the parent
  hideMenu();
  document.removeEventListener('mousedown', onMouseDown);
}

// document.addEventListener('contextmenu', onContextMenu, false);
const elements = document.querySelectorAll('.cm-line');

function addCommandHandler(e) {
  e.preventDefault();
  alert(e.target.id+' |=> '+currentCommand );
  window.parent.postMessage({command:currentCommand,oper:e.target.id}, '*'); // Send the message to the parent
  hideMenu();
  document.removeEventListener('mousedown', onMouseDown);
}

// Add the context menu handler to each element
elements.forEach(function(element) {
  element.addEventListener('contextmenu', onContextMenu);
  element.addEventListener('mouseover', function() {
    element.classList.add('active'); // Add the 'active' class on mouseover
  });

  element.addEventListener('mouseout', function() {
    element.classList.remove('active'); // Remove the 'active' class on mouseout
  });
});
