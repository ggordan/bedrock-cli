import { yellow, gray } from 'kleur';
import { block, indent } from './template';
import { prompt } from '../../util/prompt';
import {
  validateEnum,
  validateDate,
  validateString,
  validateNumber,
  validateRegExp,
  validateBoolean,
  validateCamelUpper,
} from '../../util/validation';

let initialBuild = false;

const SCHEMA_TYPES = [
  {
    title: 'String',
    value: 'String',
  },
  {
    title: 'Text',
    value: 'Text',
    description: 'Same as String but generates <textfield>',
  },
  {
    title: 'Number',
    value: 'Number',
  },
  {
    title: 'Boolean',
    value: 'Boolean',
  },
  {
    title: 'ObjectId',
    value: 'ObjectId',
  },
  {
    title: 'Date',
    value: 'Date',
  },
  {
    title: 'Mixed',
    value: 'Mixed',
    description: 'Mixed content (POJO).',
  },
  {
    title: 'Upload',
    value: 'Upload',
    description: "Shortcut for { type: ObjectId, ref: 'Upload' }",
  },
  {
    title: 'Array (String)',
    value: 'StringArray',
  },
  {
    title: 'Array (ObjectId)',
    value: 'ObjectIdArray',
  },
  {
    title: 'Array (Upload)',
    value: 'UploadArray',
    description: "Shortcut for [{ type: ObjectId, ref: 'Upload' }]",
  },
];

const SCHEMA_OPTIONS = [
  {
    title: 'required',
    value: 'required',
    selected: true,
  },
  {
    title: 'private',
    value: 'private',
    selected: false,
  },
  {
    title: 'trim',
    value: 'trim',
    selected: true,
    types: ['String', 'StringArray'],
  },
  {
    title: 'enum',
    value: 'enum',
    selected: false,
    types: ['String', 'Number', 'StringArray'],
    prompt: {
      type: 'list',
      message: 'Allowed values (comma separated):',
    },
  },
  {
    title: 'default',
    value: 'default',
    selected: false,
    prompt: {
      type: 'text',
      message: 'Default value:',
      validate: validateDefault,
    },
    types: ['String', 'Number', 'Boolean', 'Date'],
  },
  {
    title: 'minlength',
    value: 'minlength',
    selected: false,
    types: ['String'],
    prompt: {
      type: 'text',
      message: 'Minimum length:',
      validate: validateNumber,
      format: Number,
    },
  },
  {
    title: 'maxlength',
    value: 'maxlength',
    selected: false,
    types: ['String'],
    prompt: {
      type: 'text',
      message: 'Maximum length:',
      validate: validateNumber,
      format: Number,
    },
  },
  {
    title: 'match',
    value: 'match',
    selected: false,
    types: ['String', 'StringArray'],
    prompt: {
      type: 'text',
      message: 'Regex for match:',
      validate: validateRegExp,
    },
  },
  {
    title: 'integer',
    value: 'integer',
    selected: false,
    types: ['Number'],
    description: 'Creates an integer validator. Usually excessive.',
  },
  {
    title: 'min',
    value: 'min',
    selected: false,
    types: ['Number', 'Date'],
    prompt: {
      type: 'text',
      message: 'Minimum value:',
      validate: validateMixed,
      format: Number,
    },
  },
  {
    title: 'max',
    value: 'max',
    selected: false,
    types: ['Number', 'Date'],
    prompt: {
      type: 'text',
      message: 'Maximum value:',
      validate: validateMixed,
      format: Number,
    },
  },
  {
    title: 'time',
    value: 'time',
    selected: true,
    types: ['Date'],
    description:
      'Will not display the time if false. Applies to screens and modals only.',
  },
  {
    title: 'currency',
    value: 'currency',
    selected: false,
    types: ['Number'],
    description: 'Formats as currency. Applies to screens and modals only.',
    prompt: {
      type: 'select',
      message: 'Currency type:',
      choices: [
        {
          title: 'Dollars',
          value: 'dollars',
          description: 'Formats as USD.',
        },
        {
          title: 'Cents',
          value: 'cents',
          description: 'Formats as USD. Assumes integer values * 100.',
        },
      ],
    },
  },
  {
    title: 'autopopulate',
    value: 'autopopulate',
    selected: true,
    types: ['ObjectId', 'ObjectIdArray', 'Upload', 'UploadArray'],
  },
  {
    title: 'unique',
    value: 'unique',
    selected: false,
  },
  {
    title: 'index',
    value: 'index',
    selected: false,
  },
];

export async function getSchema(fields = []) {
  initialBuild = fields.length > 0;
  let action;
  while (action !== 'build') {
    if (fields.length) {
      let source = outputSchema(fields, true);
      console.log(yellow(`Building Schema:\n{\n${indent(source, 2)}\n}`));
    } else {
      console.log(yellow('Create Schema:'));
    }
    action = await getAction(fields);
    if (action === 'add') {
      fields.push(await getField({}, fields.length));
    } else if (action === 'remove') {
      fields.splice(await getFieldIndex(fields), 1);
    } else if (typeof action === 'number') {
      fields.splice(action, 1, await getField(fields[action], fields.length));
    }
  }
  return fields;
}

export function outputSchema(fields, hints) {
  return fields
    .map((field) => {
      if (field.type.match(/Array/)) {
        return outputArrayField(field, hints);
      } else {
        return outputField(field, hints);
      }
    })
    .join('\n');
}

export function definitionToSchema(definition) {
  return Object.entries(definition.attributes).map(([name, obj]) => {
    const isArray = Array.isArray(obj);
    const def = isArray ? obj[0] : obj;
    const schemaType = def.type || 'Mixed';
    let type;
    if (def.ref === 'Upload') {
      type = 'Upload';
    } else if (def.text) {
      type = 'Text';
    } else {
      type = schemaType;
    }
    if (isArray) {
      type += 'Array';
    }
    return {
      ...def,
      name,
      type,
      schemaType,
    };
  });
}

function toCode(str, type) {
  switch (type) {
    case 'String':
      return `'${str}'`;
    case 'Number':
    case 'Boolean':
      return str;
    case 'Date':
      if (str === 'now') {
        return 'Date.now';
      } else {
        return `Date.parse('${new Date(str).toISOString()}')`;
      }
  }
}

function enumToCode(arr, type) {
  arr = arr.map((el) => toCode(el, type));
  return `[${arr.join(', ')}]`;
}

function validateDefault(str, type, options) {
  if (options.enum) {
    return validateEnum(str, {
      required: true,
      choices: options.enum.map((value) => {
        return { value };
      }),
    });
  }
  return validateMixed(str, type);
}

function validateMixed(str, type) {
  switch (type) {
    case 'String':
      return validateString(str);
    case 'Number':
      return validateNumber(str);
    case 'Boolean':
      return validateBoolean(str);
    case 'Date':
      return validateDate(str);
  }
}

async function getAction(fields) {
  return await prompt({
    type: 'select',
    message: '',
    choices: [
      ...fields.map((field, i) => {
        const { name } = field;
        return {
          title: `Edit "${name}"`,
          value: i,
        };
      }),
      { title: 'Add Field', value: 'add' },
      ...(fields.length
        ? [
            { title: 'Remove Field', value: 'remove' },
            { title: 'Build Schema', value: 'build' },
          ]
        : []),
    ],
    initial: getInitialAction(fields),
    hint: 'Select Action',
  });
}

function getInitialAction(fields) {
  if (initialBuild) {
    initialBuild = false;
    return fields.length + 2;
  } else {
    return fields.length;
  }
}

async function getField(field) {
  const { name, type } = await prompt([
    {
      type: 'text',
      name: 'name',
      initial: field.name,
      validate: (name) => {
        if (!name) {
          return 'Enter valid name';
        }
        return true;
      },
      message: 'Field Name:',
    },
    {
      type: 'select',
      name: 'type',
      message: 'Field Type:',
      choices: SCHEMA_TYPES,
      initial: getInitialType(field),
      hint: 'Select One',
    },
  ]);

  if (type !== field.type) {
    // Reset field if the type changes
    // so the options don't persist.
    field = {};
  }

  let ref;
  let schemaType = type;

  if (schemaType.match(/Array/)) {
    schemaType = schemaType.replace(/Array/, '');
  }

  if (schemaType === 'Text') {
    schemaType = 'String';
  } else if (schemaType === 'Upload') {
    schemaType = 'ObjectId';
    ref = 'Upload';
  } else if (schemaType === 'ObjectId') {
    ref = await prompt({
      type: 'text',
      initial: field.ref,
      message: 'Ref (ex. UserImage):',
      validate: validateCamelUpper,
    });
  }

  const options = await getFieldOptions(type, field);

  return {
    name,
    type,
    ref,
    schemaType,
    ...options,
  };
}

async function getFieldOptions(type, field) {
  const options = {};
  const selected = await prompt({
    type: 'multiselect',
    instructions: false,
    message: 'Field Options:',
    choices: SCHEMA_OPTIONS.filter((obj) => {
      return !obj.types || obj.types.includes(type);
    }).map((obj) => {
      let selected = obj.value in field || obj.selected;
      let value = obj;
      return {
        ...obj,
        value,
        selected,
      };
    }),
    hint: 'Space to select',
  });

  for (let obj of selected) {
    if (obj.prompt) {
      const val = field[obj.value];
      options[obj.value] = await prompt({
        ...obj.prompt,
        initial: () => {
          if (obj.prompt.type === 'select') {
            const index = obj.prompt.choices.findIndex((choice) => {
              return choice.value === val;
            });
            return index === -1 ? 0 : index;
          }
          if (val && Array.isArray(val)) {
            return val.join(', ');
          } else if (val) {
            return val;
          } else if (type === 'Date') {
            return 'now';
          }
        },
        validate: (val) => {
          const { validate } = obj.prompt;
          return validate ? validate(val, type, options) : true;
        },
      });
    } else {
      options[obj.value] = true;
    }
  }

  return options;
}

async function getFieldIndex(fields) {
  return await prompt({
    type: 'select',
    message: 'Field',
    choices: [
      ...fields.map((field, i) => {
        const { name } = field;
        return {
          title: `Remove "${name}"`,
          value: i,
        };
      }),
    ],
    initial: 0,
    hint: 'Select',
  });
}

function getInitialType(field) {
  const idx = SCHEMA_TYPES.findIndex((t) => {
    return t.value === field.type;
  });
  return idx === -1 ? 0 : idx;
}

function outputField(field, hints) {
  return block`
    ${field.name}: {
      ${outputFieldOptions(field, hints)}
    },
  `;
}

function outputArrayField(field, hints) {
  return block`
    ${field.name}: [{
      ${outputFieldOptions(field, hints)}
    }],
  `;
}

function outputFieldOptions(field, hints) {
  const { schemaType: type } = field;

  let typeHint = (hints && getTypeHint(field)) || '';

  return `
      type: ${type},${typeHint}
      ${field.ref ? `ref: '${field.ref}',` : ''}
      ${field.trim ? 'trim: true,' : ''}
      ${field.required ? 'required: true,' : ''}
      ${field.default ? `default: ${toCode(field.default, type)},` : ''}
      ${field.enum ? `enum: ${enumToCode(field.enum, type)},` : ''}
      ${field.min ? `min: ${toCode(field.min, type)},` : ''}
      ${field.max ? `max: ${toCode(field.max, type)},` : ''}
      ${field.match ? `match: ${field.match},` : ''}
      ${field.minlength ? `minlength: ${field.minlength},` : ''}
      ${field.maxlength ? `maxlength: ${field.maxlength},` : ''}
      ${field.private ? "access: 'private'," : ''}
      ${field.unique ? 'unique: true,' : ''}
      ${field.index ? 'index: true,' : ''}
      ${field.autopopulate ? 'autopopulate: true,' : ''}
  `;
}

function getTypeHint(field) {
  if (field.type === 'Text') {
    return gray(' // Generates <textarea>.');
  }
  if (field.type === 'Date') {
    if (field.time) {
      return gray(' // Date with time.');
    } else {
      return gray(' // Date only.');
    }
  }
  if (field.currency === 'dollars') {
    return gray(' // Formatted in dollars.');
  } else if (field.currency === 'cents') {
    return gray(' // Formatted in dollars. Value in cents.');
  }
}
