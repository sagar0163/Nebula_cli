import parser from 'bash-parser';

const cmds = [
    '$(echo rm)',
    'Comp=$(echo rm) && $Comp'
];

for (const cmd of cmds) {
    console.log('--- CMD:', cmd, '---');
    const ast = parser(cmd);
    console.log(JSON.stringify(ast, null, 2));
}
