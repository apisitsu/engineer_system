const React = require('react');
const ReactDOMServer = require('react-dom/server');
const { Table } = require('antd');

const columns = [{ title: 'Name', dataIndex: 'name', key: 'name' }];
const data = [{ key: 1, name: 'John Brown' }];

const html = ReactDOMServer.renderToString(
    React.createElement(Table, { columns, dataSource: data, scroll: { x: 'max-content' }, className: 'kb-vscroll' })
);

console.log(html);
