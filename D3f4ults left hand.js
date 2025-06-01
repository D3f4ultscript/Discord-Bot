const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config();

// Create bot with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const token = process.env.DISCORD_TOKEN;
const clientId = "1378457140456460479";

// Define Slash Commands
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
];

// Event when bot is ready
client.once('ready', async () => {
    console.log(`Bot is online as ${client.user.tag}!`);
    
    // Register Slash Commands
    const rest = new REST({ version: '10' }).setToken(token);
    
    try {
        console.log('Registering Slash Commands...');
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );
        console.log('Slash Commands successfully registered!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// Event for Slash Commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'script') {
        const scriptCode = '```lua\nloadstring(game:HttpGet("https://raw.githubusercontent.com/D3f4ultscript/Scripts-for-D3f4ult-Hub/refs/heads/main/Hub.lua"))()\n```';
        await interaction.reply(`${interaction.user}\n${scriptCode}`);
    }
    
    if (interaction.commandName === 'info') {
        const scriptCode = '```lua\nloadstring(game:HttpGet("https://raw.githubusercontent.com/D3f4ultscript/Scripts-for-D3f4ult-Hub/refs/heads/main/Hub.lua"))()\n```';
        const serverInvite = 'https://discord.gg/2ynN9zcVFk';
        const ownerInfo = '**Server and Script Owner: D3f4ult**';
        
        await interaction.reply(`${interaction.user}\n\n${serverInvite}\n\n${scriptCode}\n\n${ownerInfo}`);
    }
    
    if (interaction.commandName === 'chatclear') {
        const allowedRoleIds = ['1274094855941001350', '1378458013492576368'];
        
        // Check if user has any of the required roles
        const hasRequiredRole = interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id));
        
        if (!hasRequiredRole) {
            await interaction.reply({ content: '❌ You do not have permission to use this command! You need specific roles to clear the chat.', ephemeral: true });
            return;
        }
        
        // Create confirmation buttons
        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_clear')
            .setLabel('Yes, Clear Channel')
            .setStyle(ButtonStyle.Danger);
            
        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_clear')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);
            
        const row = new ActionRowBuilder()
            .addComponents(confirmButton, cancelButton);
            
        await interaction.reply({
            content: '⚠️ Are you sure you want to delete ALL messages in this channel?',
            components: [row],
            ephemeral: true
        });
    }

    if (interaction.commandName === 'freewebh') {
        const allowedRoleIds = ['1274094855941001350', '1378458013492576368'];
        
        // Check if user has any of the required roles
        const hasRequiredRole = interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id));
        
        if (!hasRequiredRole) {
            await interaction.reply({ content: '❌ You do not have permission to use this command! You need specific roles to create webhooks.', ephemeral: true });
            return;
        }

        const channel = interaction.options.getChannel('channel');
        const webhookName = interaction.options.getString('name');

        // Check if the channel is a text channel
        if (!channel.isTextBased()) {
            await interaction.reply({ 
                content: '❌ The selected channel must be a text channel!', 
                ephemeral: true 
            });
            return;
        }

        try {
            // Create the webhook
            const webhook = await channel.createWebhook({
                name: webhookName,
                avatar: client.user.displayAvatarURL(),
            });

            // Send message in the channel about webhook creation
            await channel.send({
                content: `🎉 **New Free Webhook Created**\nName: \`${webhookName}\`\nURL: ${webhook.url}\nCreated by: ${interaction.user}`,
                allowedMentions: { users: [] } // Prevents pinging the user who created it
            });

            // Send confirmation to the user
            await interaction.reply({ 
                content: `✅ Webhook created successfully!\nName: ${webhookName}\nChannel: ${channel}\nURL: ${webhook.url}`, 
                ephemeral: true 
            });

        } catch (error) {
            console.error('Error creating webhook:', error);
            await interaction.reply({ 
                content: '❌ Failed to create webhook! Make sure I have the necessary permissions.', 
                ephemeral: true 
            });
        }
    }

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
                    name: '!ping',
                    value: 'Bot responds with "Pong!" to check if it\'s online',
                },
                {
                    name: '!hello',
                    value: 'Get a friendly greeting from the bot',
                }
            ],
            footer: {
                text: 'Commands marked with 🔒 require specific roles to use'
            },
            timestamp: new Date(),
        };

        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    }
});

// Event for Button Interactions
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId === 'confirm_clear') {
            const allowedRoleIds = ['1274094855941001350', '1378458013492576368'];
            
            // Check roles again
            const hasRequiredRole = interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id));
            
            if (!hasRequiredRole) {
                await interaction.update({ content: '❌ No permission! You need specific roles to clear the chat.', components: [] });
                return;
            }
            
            try {
                await interaction.update({ content: '🔄 Clearing channel...', components: [] });
                
                // Delete all messages
                let deleted;
                do {
                    deleted = await interaction.channel.bulkDelete(100, true);
                } while (deleted.size > 0);
                
                await interaction.followUp({ content: '✅ Channel has been successfully cleared!', ephemeral: true });
            } catch (error) {
                console.error('Error while deleting:', error);
                await interaction.followUp({ content: '❌ Error while deleting messages!', ephemeral: true });
            }
        }
        
        if (interaction.customId === 'cancel_clear') {
            await interaction.update({ content: 'Channel clearing cancelled.', components: [] });
        }
    }
});

// Event for Messages
client.on('messageCreate', (message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // Simple commands
    if (message.content === '!ping') {
        message.reply('Pong!');
    }
    
    if (message.content === '!hello') {
        message.reply('Hello! I am your Discord Bot!');
    }
});

// Login bot with token
client.login(token);
