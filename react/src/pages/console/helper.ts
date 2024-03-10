import {LabelValue} from "../../types/LabelValue";

const fillCollectionCommands = (collection:string) => {
    return [
        {
            label: `List `
        }
    ]
}


export const commandTypes: LabelValue[]= [
    {label: 'All', value: ''},
    {label:'User', value:'user'},
    {label: 'Custom', value: 'custom'},
    {label: 'Collection', value: 'collection'},
];
