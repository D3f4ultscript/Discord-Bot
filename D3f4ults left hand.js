const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const token = "MTM3ODQ1NzE0MDQ1NjQ2MDQ3OQ.GJB136.zb93pwKFpsupusNblgTx1bG51bQ5KnU5-qd6qA";
const clientId = "1378457140456460479";

// Commands definieren
const commands = [
    new SlashCommandBuilder()
        .setName('script')
        .setDescription('Outputs the D3f4ult Hub Script'),
    new SlashCommandBuilder()
        .setName('chatclear')
        .setDescription('Deletes all messages in the channel (requires special role)'),
    new SlashCommandBuilder()
        .setName('info')
        .setDescription('Shows server info and script'),
    new SlashCommandBuilder()
        .setName('freewebh')
        .setDescription('Creates a webhook in the specified channel (requires special role)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Select the channel for the webhook')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name for the webhook')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands and their descriptions'),
    new SlashCommandBuilder()
        .setName('createrole')
        .setDescription('Creates a role with predefined permissions (requires special role)')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('The type of role to create')
                .setRequired(true)
                .addChoices(
                    { name: '👑 Owner', value: 'owner' },
                    { name: '⚡ Admin', value: 'admin' },
                    { name: '🛡️ Moderator', value: 'moderator' },
                    { name: '🎮 VIP', value: 'vip' },
                    { name: '👤 Member', value: 'member' }
                ))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Custom name for the role (optional)')
                .setRequired(false))
];

// Bot startet
client.once('ready', async () => {
    console.log(`Bot ist online als ${client.user.tag}!`);
    
    // Commands registrieren
    const rest = new REST({ version: '10' }).setToken(token);
    
    try {
        console.log('Registriere Commands...');
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );
        console.log('Commands erfolgreich registriert!');
    } catch (error) {
        console.error('Fehler beim Registrieren:', error);
    }
});

// Command Handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // Script Command
    if (interaction.commandName === 'script') {
        const scriptCode = '```lua\nloadstring(game:HttpGet("https://raw.githubusercontent.com/D3f4ultscript/Scripts-for-D3f4ult-Hub/refs/heads/main/Hub.lua"))()\n```';
        await interaction.reply(`${interaction.user}\n${scriptCode}`);
    }
    
    // Info Command
    if (interaction.commandName === 'info') {
        const scriptCode = '```lua\nloadstring(game:HttpGet("https://raw.githubusercontent.com/D3f4ultscript/Scripts-for-D3f4ult-Hub/refs/heads/main/Hub.lua"))()\n```';
        const serverInvite = 'https://discord.gg/2ynN9zcVFk';
        const ownerInfo = '**Server and Script Owner: D3f4ult**';
        await interaction.reply(`${interaction.user}\n\n${serverInvite}\n\n${scriptCode}\n\n${ownerInfo}`);
    }
    
    // Chatclear Command
    if (interaction.commandName === 'chatclear') {
        const allowedRoleIds = ['1274094855941001350', '1378458013492576368'];
        if (!interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id))) {
            await interaction.reply({ content: '❌ You do not have permission to use this command!', ephemeral: true });
            return;
        }
        try {
            let deleted;
            do {
                deleted = await interaction.channel.bulkDelete(100, true);
            } while (deleted.size > 0);
            await interaction.reply({ content: '✅ Channel has been cleared!', ephemeral: true });
        } catch (error) {
            console.error('Error clearing chat:', error);
            await interaction.reply({ content: '❌ Error while clearing messages!', ephemeral: true });
        }
    }

    // Webhook Command
    if (interaction.commandName === 'freewebh') {
        const allowedRoleIds = ['1274094855941001350', '1378458013492576368'];
        if (!interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id))) {
            await interaction.reply({ content: '❌ You do not have permission to use this command!', ephemeral: true });
            return;
        }

        const channel = interaction.options.getChannel('channel');
        const webhookName = interaction.options.getString('name');

        try {
            const webhook = await channel.createWebhook({
                name: webhookName,
                avatar: client.user.displayAvatarURL(),
            });
            await channel.send({
                content: `🎉 **New Free Webhook Created**\nName: \`${webhookName}\`\nURL: ${webhook.url}\nCreated by: ${interaction.user}`,
                allowedMentions: { users: [] }
            });
            await interaction.reply({ 
                content: `✅ Webhook created successfully!\nName: ${webhookName}\nChannel: ${channel}\nURL: ${webhook.url}`, 
                ephemeral: true 
            });
        } catch (error) {
            await interaction.reply({ 
                content: '❌ Failed to create webhook! Make sure I have the necessary permissions.', 
                ephemeral: true 
            });
        }
    }

    // Help Command
    if (interaction.commandName === 'help') {
        const helpEmbed = {
            color: 0x0099FF,
            title: '📚 Available Commands',
            description: 'Here are all available commands:',
            fields: [
                {
                    name: '/help',
                    value: 'Shows this help message with all available commands',
                },
                {
                    name: '/script',
                    value: 'Outputs the D3f4ult Hub Script',
                },
                {
                    name: '/info',
                    value: 'Shows server information and the script',
                },
                {
                    name: '/chatclear',
                    value: '🔒 Deletes all messages in the channel\n*(Requires special role)*',
                },
                {
                    name: '/freewebh',
                    value: '🔒 Creates a webhook in the specified channel\n*(Requires special role)*',
                },
                {
                    name: '/createrole',
                    value: '🔒 Creates a role with predefined permissions\n*(Requires special role)*',
                }
            ],
            footer: {
                text: 'Commands marked with 🔒 require specific roles to use'
            },
            timestamp: new Date(),
        };
        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    }

    // Create Role Command
    if (interaction.commandName === 'createrole') {
        const allowedRoleIds = ['1274094855941001350', '1378458013492576368'];
        if (!interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id))) {
            await interaction.reply({ content: '❌ You do not have permission to use this command!', ephemeral: true });
            return;
        }

        const roleType = interaction.options.getString('type');
        const customName = interaction.options.getString('name');

        const rolePresets = {
            owner: {
                name: customName || '👑 Owner',
                color: '#FF0000',
                permissions: ['Administrator'],
            },
            admin: {
                name: customName || '⚡ Admin',
                color: '#FFA500',
                permissions: ['Administrator'],
            },
            moderator: {
                name: customName || '🛡️ Moderator',
                color: '#00FF00',
                permissions: [
                    'ViewAuditLog', 'ModerateMembers', 'KickMembers',
                    'ManageMessages', 'ManageThreads', 'ManageNicknames',
                    'MuteMembers', 'DeafenMembers', 'MoveMembers',
                    'ViewChannel', 'SendMessages', 'SendMessagesInThreads',
                    'CreatePublicThreads', 'CreatePrivateThreads',
                    'EmbedLinks', 'AttachFiles', 'AddReactions',
                    'UseExternalEmojis', 'UseExternalStickers',
                    'MentionEveryone', 'ReadMessageHistory',
                    'UseApplicationCommands', 'Connect', 'Speak',
                    'Stream', 'UseVAD', 'PrioritySpeaker', 'RequestToSpeak'
                ],
            },
            vip: {
                name: customName || '🎮 VIP',
                color: '#FF69B4',
                permissions: [
                    'ViewChannel', 'SendMessages', 'SendMessagesInThreads',
                    'CreatePublicThreads', 'CreatePrivateThreads',
                    'SendVoiceMessages', 'EmbedLinks', 'AttachFiles',
                    'AddReactions', 'UseExternalEmojis', 'UseExternalStickers',
                    'ReadMessageHistory', 'UseApplicationCommands',
                    'Connect', 'Speak', 'Stream', 'UseVAD',
                    'PrioritySpeaker', 'RequestToSpeak', 'UseSoundboard',
                    'UseEmbeddedActivities', 'ChangeNickname',
                    'CreateInstantInvite', 'UseExternalSounds'
                ],
            },
            member: {
                name: customName || '👤 Member',
                color: '#808080',
                permissions: [
                    'ViewChannel', 'SendMessages', 'SendMessagesInThreads',
                    'CreatePublicThreads', 'CreatePrivateThreads',
                    'SendVoiceMessages', 'EmbedLinks', 'AttachFiles',
                    'AddReactions', 'UseExternalEmojis', 'UseExternalStickers',
                    'ReadMessageHistory', 'UseApplicationCommands',
                    'Connect', 'Speak', 'Stream', 'UseVAD',
                    'UseSoundboard', 'UseEmbeddedActivities',
                    'RequestToSpeak', 'CreateInstantInvite'
                ],
            }
        };

        try {
            const roleSettings = rolePresets[roleType];
            const newRole = await interaction.guild.roles.create({
                name: roleSettings.name,
                color: roleSettings.color,
                permissions: roleSettings.permissions,
                reason: 'Created via command'
            });

            await interaction.reply({ 
                content: `✅ Role "${roleSettings.name}" has been created successfully!`, 
                ephemeral: true 
            });
        } catch (error) {
            console.error('Error creating role:', error);
            await interaction.reply({ 
                content: '❌ Failed to create role! Make sure I have the necessary permissions.', 
                ephemeral: true 
            });
        }
    }
});

// Bot einloggen
client.login(token);
