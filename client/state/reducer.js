import immutable from 'immutable';
import setCssVariable from '../../utils/setCssVariable';
import config from '../../config/client';

const primaryColor = window.localStorage.getItem('primaryColor') || config.primaryColor;
const primaryTextColor = window.localStorage.getItem('primaryTextColor') || config.primaryTextColor;
setCssVariable(primaryColor, primaryTextColor);

let backgroundImage = window.localStorage.getItem('backgroundImage');
if (!backgroundImage) {
    backgroundImage = config.backgroundImage; // eslint-disable-line
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const base64 = canvas.toDataURL('image/png');
        window.localStorage.setItem('backgroundImage', base64);
    };
    img.src = backgroundImage;
}
const sound = window.localStorage.getItem('sound') || config.sound;

const initialState = immutable.fromJS({
    user: null,
    focus: '',
    connect: true,
    ui: {
        showLoginDialog: false,
        primaryColor,
        primaryTextColor,
        backgroundImage,
        sound,
    },
});


function reducer(state = initialState, action) {
    switch (action.type) {
    case 'Logout': {
        const keepKeys = [
            ['ui', 'primaryColor'],
            ['ui', 'primaryTextColor'],
            ['ui', 'backgroundImage'],
            ['ui', 'sound'],
        ];
        let newState = initialState;
        for (const key of keepKeys) {
            newState = newState.setIn(key, state.getIn(key));
        }
        return newState;
    }
    case 'SetDeepValue': {
        return state.setIn(action.keys, immutable.fromJS(action.value));
    }

    case 'SetUser': {
        return state
            .set('user', immutable.fromJS(action.user))
            .set('focus', action.user.linkmans[0]._id);
    }
    case 'SetLinkmanMessages': {
        const newLinkmans = state
            .getIn(['user', 'linkmans'])
            .map(linkman => (
                linkman.set('messages', immutable.fromJS(action.messages[linkman.get('_id')]))
            ))
            .sort((linkman1, linkman2) => {
                const messages1 = linkman1.get('messages');
                const messages2 = linkman2.get('messages');
                const time1 = messages1.size > 0 ? messages1.get(messages1.size - 1).get('createTime') : linkman1.get('createTime');
                const time2 = messages2.size > 0 ? messages2.get(messages2.size - 1).get('createTime') : linkman2.get('createTime');
                return new Date(time1) < new Date(time2);
            });
        return state
            .setIn(['user', 'linkmans'], newLinkmans)
            .set('focus', newLinkmans.getIn([0, '_id']));
    }
    case 'SetGroupMembers': {
        const linkmanIndex = state
            .getIn(['user', 'linkmans'])
            .findIndex(l => l.get('_id') === action.groupId);
        return state.setIn(['user', 'linkmans', linkmanIndex, 'members'], immutable.fromJS(action.members));
    }
    case 'SetGroupAvatar': {
        const linkmanIndex = state
            .getIn(['user', 'linkmans'])
            .findIndex(l => l.get('_id') === action.groupId);
        return state.setIn(['user', 'linkmans', linkmanIndex, 'avatar'], action.avatar);
    }
    case 'SetFocus': {
        const linkmanIndex = state
            .getIn(['user', 'linkmans'])
            .findIndex(l => l.get('_id') === action.linkmanId);
        return state
            .set('focus', action.linkmanId)
            .setIn(['user', 'linkmans', linkmanIndex, 'unread'], 0);
    }
    case 'SetFriend': {
        const linkmanIndex = state
            .getIn(['user', 'linkmans'])
            .findIndex(l => l.get('_id') === action.linkmanId);
        return state
            .updateIn(['user', 'linkmans', linkmanIndex], linkman => (
                linkman.set('type', 'friend')
            ))
            .set('focus', action.linkmanId);
    }

    case 'AddLinkman': {
        const newState = state.updateIn(['user', 'linkmans'], linkmans => (
            linkmans.unshift(immutable.fromJS(action.linkman))
        ));
        if (action.focus) {
            return newState.set('focus', action.linkman._id);
        }
        return newState;
    }
    case 'RemoveLinkman': {
        const linkmanIndex = state
            .getIn(['user', 'linkmans'])
            .findIndex(l => l.get('_id') === action.linkmanId);
        const newState = state.updateIn(['user', 'linkmans'], linkmans => (
            linkmans.delete(linkmanIndex)
        ));
        return newState.set('focus', newState.getIn(['user', 'linkmans', 0, '_id']));
    }
    case 'AddLinkmanMessage': {
        const linkmanIndex = state
            .getIn(['user', 'linkmans'])
            .findIndex(l => l.get('_id') === action.linkmanId);
        const linkman = state.getIn(['user', 'linkmans', linkmanIndex]);
        let unread = 0;
        if (state.get('focus') !== linkman.get('_id')) {
            unread = linkman.get('unread') + 1;
        }
        return state
            .updateIn(['user', 'linkmans'], linkmans => (
                linkmans
                    .delete(linkmanIndex)
                    .unshift(linkman
                        .update('messages', messages => (
                            messages.push(immutable.fromJS(action.message))
                        ))
                        .set('unread', unread))
            ));
    }
    case 'AddLinkmanMessages': {
        const linkmanIndex = state
            .getIn(['user', 'linkmans'])
            .findIndex(l => l.get('_id') === action.linkmanId);
        return state
            .updateIn(['user', 'linkmans', linkmanIndex], l => (
                l.update('messages', messages => (
                    immutable.fromJS(action.messages).concat(messages)
                ))
            ));
    }

    case 'UpdateSelfMessage': {
        const linkmanIndex = state
            .getIn(['user', 'linkmans'])
            .findIndex(l => l.get('_id') === action.linkmanId);
        return state.updateIn(['user', 'linkmans', linkmanIndex, 'messages'], (messages) => {
            const messageIndex = messages.findLastIndex(m => m.get('_id') === action.messageId);
            return messages.update(messageIndex, message => message.mergeDeep(immutable.fromJS(action.message)));
        });
    }
    case 'SetAvatar': {
        const userId = state.getIn(['user', '_id']);
        return state
            .setIn(['user', 'avatar'], action.avatar)
            .updateIn(['user', 'linkmans'], linkmans => (
                linkmans.map(l => (
                    l.update('messages', messages => (
                        messages.map((message) => {
                            if (message.getIn(['from', '_id']) === userId) {
                                return message.setIn(['from', 'avatar'], action.avatar);
                            }
                            return message;
                        })
                    ))
                ))
            ));
    }

    default:
        return state;
    }
}

export default reducer;
